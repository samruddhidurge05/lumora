import { db } from '../firebase.js';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { backendFetch } from '../utils/api';

export const affiliateService = {
  // Submit affiliate application
  applyAsAffiliate: async (userId, name, email) => {
    // Check if an application already exists
    const q = query(collection(db, 'affiliateApplications'), where('userId', '==', userId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error('You already have an affiliate application in progress.');
    }

    const applicationData = {
      userId,
      name,
      email,
      status: 'pending',
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null
    };

    const docRef = await addDoc(collection(db, 'affiliateApplications'), applicationData);
    return { id: docRef.id, ...applicationData };
  },

  // Check affiliate and application status
  getAffiliateStatus: async (userId) => {
    // Check approved affiliate record first
    const affQuery = query(collection(db, 'affiliates'), where('userId', '==', userId));
    const affSnap = await getDocs(affQuery);
    
    if (!affSnap.empty) {
      const docSnap = affSnap.docs[0];
      return {
        isApproved: true,
        affiliate: { id: docSnap.id, ...docSnap.data() },
        application: null
      };
    }

    // Check application status
    const appQuery = query(collection(db, 'affiliateApplications'), where('userId', '==', userId));
    const appSnap = await getDocs(appQuery);
    
    if (!appSnap.empty) {
      const docSnap = appSnap.docs[0];
      return {
        isApproved: false,
        affiliate: null,
        application: { id: docSnap.id, ...docSnap.data() }
      };
    }

    return {
      isApproved: false,
      affiliate: null,
      application: null
    };
  },

  // Validate affiliate code and record link clicks
  validateAndRecordClick: async (affiliateCode, productId, visitorId) => {
    if (!affiliateCode) return { valid: false };

    // Find affiliate record by code
    const q = query(
      collection(db, 'affiliates'),
      where('affiliateCode', '==', affiliateCode),
      where('status', 'in', ['approved', 'active'])
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return { valid: false };
    }

    const affiliateDoc = snap.docs[0];
    const affiliateId = affiliateDoc.id;
    const affiliateData = affiliateDoc.data();

    // Prevent affiliate from clicking their own links if visitorId matches their userId
    if (visitorId && visitorId === affiliateData.userId) {
      return { valid: true, ignored: true, reason: 'self-click' };
    }

    // Duplicate Click prevention (Same visitor, same product, in the last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const clickQuery = query(
      collection(db, 'affiliateClicks'),
      where('visitorId', '==', visitorId),
      where('productId', '==', productId),
      where('affiliateCode', '==', affiliateCode),
      where('createdAt', '>=', oneDayAgo),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    // We fetch without catch since local index issues are logged
    const clickSnap = await getDocs(clickQuery);
    if (!clickSnap.empty) {
      return { valid: true, ignored: true, reason: 'duplicate-click' };
    }

    // Record the click
    const clickData = {
      affiliateId,
      affiliateCode,
      productId,
      visitorId,
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'affiliateClicks'), clickData);

    // Update aggregates on the affiliate profile
    await updateDoc(doc(db, 'affiliates', affiliateId), {
      totalClicks: (affiliateData.totalClicks || 0) + 1
    });

    // Record activity logs
    await addDoc(collection(db, 'affiliateActivity'), {
      affiliateId,
      type: 'click',
      title: 'Click registered',
      description: `Visitor visited link for Product ID: ${productId}`,
      createdAt: new Date().toISOString()
    });

    return { valid: true, ignored: false };
  },

  // Record conversion and commission details on successful order
  createConversionsForOrder: async (order, affiliateReferral) => {
    const { affiliateCode } = affiliateReferral;
    
    // Find affiliate profile
    const q = query(
      collection(db, 'affiliates'),
      where('affiliateCode', '==', affiliateCode),
      where('status', 'in', ['approved', 'active'])
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const affiliateDoc = snap.docs[0];
    const affiliateId = affiliateDoc.id;
    const affiliateData = affiliateDoc.data();

    // Fraud check: self-purchasing via own referral link
    if (order.customerId === affiliateData.userId) {
      console.warn('[Affiliate] Self-referral purchase ignored for user:', order.customerId);
      return;
    }

    // Phase 2 & 6: Verify if affiliate program is enabled globally and specific user status is valid
    const userDocRef = doc(db, 'users', affiliateData.userId);
    const userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      console.warn('[Affiliate] Affiliate user profile does not exist in users collection:', affiliateData.userId);
      return;
    }
    const userData = userSnap.data();

    const settingsRef = doc(db, 'platformSettings', 'global');
    const settingsSnap = await getDoc(settingsRef);
    const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};
    const affiliateProgramEnabled = settingsData.affiliateProgramEnabled ?? true;

    const isApproved = userData.isApproved || userData.role === 'Affiliate' || userData.role === 'Admin';
    const isSuspended = userData.isSuspended ?? false;
    const canPromote = userData.canPromote ?? true;

    if (!isApproved || isSuspended || !canPromote || !affiliateProgramEnabled) {
      console.warn('[Affiliate] Commission blocked because affiliate status or program is disabled/suspended. Stats:', {
        isApproved, isSuspended, canPromote, affiliateProgramEnabled
      });
      return;
    }
    const items = order.items || [];
    let orderTotalINR = 0;
    let orderCommissionINR = 0;
    const batch = writeBatch(db);
    let actualAddedItemsCount = 0;
    for (const item of items) {
      const saleAmountUSD = item.snapshot?.price || 0;
      // Convert to INR with standard multiplier (1 USD = 80 INR)
      const saleAmountINR = Math.round(saleAmountUSD * 80);
      
      let commissionAmountINR = 0;
      try {
        const prodData = await backendFetch(`/products/${item.productId}`);
        if (prodData) {
          // If affiliate program is disabled on this product, skip it!
          if (prodData.affiliate_enabled === false) {
            console.log(`[Affiliate] Affiliate marketing is disabled for product ${item.productId}. Skipping commission.`);
            continue;
          }
          if (prodData.commission_type === 'fixed') {
            commissionAmountINR = Math.round(prodData.commission_value || 0);
          } else {
            const pct = prodData.commission_value !== undefined ? prodData.commission_value : (affiliateData.commissionRate || 30);
            commissionAmountINR = Math.round((saleAmountINR * pct) / 100);
          }
        } else {
          const commissionRate = affiliateData.commissionRate || 30;
          commissionAmountINR = Math.round((saleAmountINR * commissionRate) / 100);
        }
      } catch (err) {
        console.warn('[Affiliate] Error checking product settings from backend, falling back:', err);
        const commissionRate = affiliateData.commissionRate || 30;
        commissionAmountINR = Math.round((saleAmountINR * commissionRate) / 100);
      }

      orderTotalINR += saleAmountINR;
      orderCommissionINR += commissionAmountINR;
      actualAddedItemsCount += 1;

      // Create affiliateConversion document
      const conversionRef = doc(collection(db, 'affiliateConversions'));
      batch.set(conversionRef, {
        affiliateId,
        affiliateCode,
        orderId: order.orderId,
        productId: item.productId,
        vendorId: item.vendorId || '',
        buyerId: order.customerId,
        saleAmount: saleAmountINR,
        commissionAmount: commissionAmountINR,
        status: 'pending', // Pending payment validation
        createdAt: new Date().toISOString()
      });

      // Create activity logs
      const activityRef = doc(collection(db, 'affiliateActivity'));
      batch.set(activityRef, {
        affiliateId,
        type: 'conversion',
        title: 'Commission pending',
        description: `Commission of ₹${commissionAmountINR} pending for "${item.snapshot?.title || 'Product'}"`,
        createdAt: new Date().toISOString()
      });
    }

    if (actualAddedItemsCount === 0) {
      console.log('[Affiliate] No eligible affiliate products in order.');
      return;
    }

    // Update affiliates aggregates
    const affRef = doc(db, 'affiliates', affiliateId);
    batch.update(affRef, {
      totalConversions: (affiliateData.totalConversions || 0) + actualAddedItemsCount,
      totalRevenue: (affiliateData.totalRevenue || 0) + orderTotalINR,
      totalCommission: (affiliateData.totalCommission || 0) + orderCommissionINR,
      pendingCommission: (affiliateData.pendingCommission || 0) + orderCommissionINR
    });

    await batch.commit();
  },

  // Approve pending commissions when order changes status to 'Completed'
  approveCommissionsForOrder: async (orderId) => {
    const q = query(
      collection(db, 'affiliateConversions'),
      where('orderId', '==', orderId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      batch.update(docSnap.ref, { status: 'approved' });

      // Add activity entry
      const activityRef = doc(collection(db, 'affiliateActivity'));
      batch.set(activityRef, {
        affiliateId: data.affiliateId,
        type: 'commission',
        title: 'Commission earned',
        description: `Commission of ₹${data.commissionAmount} approved for order ${orderId}`,
        createdAt: new Date().toISOString()
      });
    }
    await batch.commit();
  },

  // Refund commissions when order changes status to 'Refunded'
  refundCommissionsForOrder: async (orderId) => {
    const q = query(
      collection(db, 'affiliateConversions'),
      where('orderId', '==', orderId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    // Group refund amounts by affiliateId to update profiles correctly
    const affRefundMap = {};

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const affId = data.affiliateId;

      if (data.status === 'refunded') continue; // Already processed

      batch.update(docSnap.ref, { status: 'refunded' });

      if (!affRefundMap[affId]) {
        affRefundMap[affId] = { revenue: 0, commission: 0, pendingCount: 0 };
      }
      affRefundMap[affId].revenue += data.saleAmount;
      affRefundMap[affId].commission += data.commissionAmount;
      if (data.status === 'pending' || data.status === 'approved') {
        affRefundMap[affId].pendingCount++;
      }

      // Add activity entry
      const activityRef = doc(collection(db, 'affiliateActivity'));
      batch.set(activityRef, {
        affiliateId: affId,
        type: 'refund',
        title: 'Commission reversed',
        description: `Commission of ₹${data.commissionAmount} reversed due to order refund`,
        createdAt: new Date().toISOString()
      });
    }

    // Process refunds on affiliate profile docs
    for (const [affId, refund] of Object.entries(affRefundMap)) {
      const affRef = doc(db, 'affiliates', affId);
      const affSnap = await getDoc(affRef);
      if (affSnap.exists()) {
        const affData = affSnap.data();
        batch.update(affRef, {
          totalRevenue: Math.max(0, (affData.totalRevenue || 0) - refund.revenue),
          totalCommission: Math.max(0, (affData.totalCommission || 0) - refund.commission),
          pendingCommission: Math.max(0, (affData.pendingCommission || 0) - refund.commission),
          totalConversions: Math.max(0, (affData.totalConversions || 0) - refund.pendingCount)
        });
      }
    }

    await batch.commit();
  },

  // Request withdrawal (payout)
  requestPayout: async (affiliateId, amount) => {
    if (!amount || isNaN(amount) || Number(amount) < 500) {
      throw new Error('Minimum withdrawal limit is ₹500.');
    }

    // Phase 5: Block payout requests if suspended
    const userDocRef = doc(db, 'users', affiliateId);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists() && userSnap.data().isSuspended) {
      throw new Error('Your affiliate account has been suspended. Payout requests are blocked.');
    }

    const affRef = doc(db, 'affiliates', affiliateId);
    const affSnap = await getDoc(affRef);
    if (!affSnap.exists()) {
      throw new Error('Affiliate profile not found.');
    }

    const affData = affSnap.data();
    const pendingVal = affData.pendingCommission || 0;

    // Fraud protection: Fetch all currently pending requests to prevent double withdrawal of same funds
    const payoutQuery = query(
      collection(db, 'affiliatePayoutRequests'),
      where('affiliateId', '==', affiliateId),
      where('status', '==', 'pending')
    );
    const payoutSnap = await getDocs(payoutQuery);
    const sumPendingPayouts = payoutSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);

    if (pendingVal - sumPendingPayouts < amount) {
      throw new Error('Insufficient approved commission balance to cover this withdrawal request.');
    }

    return await backendFetch('/api/affiliate/payouts', {
      method: 'POST',
      body: JSON.stringify({ affiliate_id: affiliateId, amount })
    });
  },

  // Update affiliate details in profile settings
  updateProfile: async (affiliateId, profileData) => {
    const affRef = doc(db, 'affiliates', affiliateId);
    await updateDoc(affRef, {
      name: profileData.name || '',
      email: profileData.email || '',
      phone: profileData.phone || '',
      upiId: profileData.upiId || '',
      bankName: profileData.bankName || '',
      accountNumber: profileData.accountNumber || '',
      ifscCode: profileData.ifscCode || ''
    });
  },

  // Suspend affiliate user (Admin action)
  suspendAffiliate: async (uid) => {
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, {
      isSuspended: true,
    });
    // Create suspension notification
    await addDoc(collection(db, 'notifications'), {
      userId: uid,
      title: 'Account Suspended',
      body: 'Your affiliate account has been suspended.',
      message: 'Your affiliate account has been suspended.',
      type: 'warning',
      read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  },

  // Unsuspend affiliate user (Admin action)
  unsuspendAffiliate: async (uid) => {
    const ref = doc(db, 'users', uid);
    await updateDoc(ref, {
      isSuspended: false,
    });
    // Create restore notification
    await addDoc(collection(db, 'notifications'), {
      userId: uid,
      title: 'Account Restored',
      body: 'Your affiliate account suspension has been lifted.',
      message: 'Your affiliate account suspension has been lifted.',
      type: 'success',
      read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
};
