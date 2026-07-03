import React, { createContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import { db } from '../firebase.js';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
  getDocs,
  setDoc,
  updateDoc,
  doc
} from 'firebase/firestore';

export const AffiliateContext = createContext(null);

export function AffiliateProvider({ children }) {
  const { user, updateRole } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [canPromote, setCanPromote] = useState(true);
  const [affiliateProgramEnabled, setAffiliateProgramEnabled] = useState(true);
  const [affiliate, setAffiliate] = useState(null);
  const [application, setApplication] = useState(null);
  const [conversions, setConversions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const affiliateAllowed = useMemo(() => {
    return isApproved && !isSuspended && canPromote && affiliateProgramEnabled;
  }, [isApproved, isSuspended, canPromote, affiliateProgramEnabled]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setIsApproved(false);
      setIsSuspended(false);
      setCanPromote(true);
      setAffiliate(null);
      setApplication(null);
      setConversions([]);
      setPayouts([]);
      setActivity([]);
      setNotifications([]);
      return;
    }

    setLoading(true);
    let unsubAff = null;
    let unsubUserDoc = null;
    let unsubSettings = null;
    let unsubConv = null;
    let unsubPayouts = null;
    let unsubActivity = null;
    let unsubNotifs = null;

    // Track initialization of our main snapshots to prevent flash of wrong UI
    let settingsLoaded = false;
    let userDocLoaded = false;
    let affiliateDocLoaded = false;

    const checkLoadingDone = () => {
      if (settingsLoaded && userDocLoaded && affiliateDocLoaded) {
        setLoading(false);
      }
    };

    // 1. Listen to platformSettings/global (real-time, Phase 3)
    unsubSettings = onSnapshot(doc(db, 'platformSettings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAffiliateProgramEnabled(data.affiliateProgramEnabled ?? true);
      } else {
        setAffiliateProgramEnabled(true);
      }
      settingsLoaded = true;
      checkLoadingDone();
    }, (err) => {
      console.warn('[AffiliateContext] Settings listener failed:', err.message);
      settingsLoaded = true;
      checkLoadingDone();
    });

    // 2. Listen to users/{user.uid} (real-time, Phase 3)
    unsubUserDoc = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setIsApproved(data.isApproved || data.role === 'Affiliate' || data.role === 'Admin');
        setIsSuspended(data.isSuspended ?? false);
        setCanPromote(data.canPromote ?? true);
      }
      userDocLoaded = true;
      checkLoadingDone();
    }, (err) => {
      console.warn('[AffiliateContext] User doc listener failed:', err.message);
      userDocLoaded = true;
      checkLoadingDone();
    });

    // 3. Listen to approved affiliates profile (collection "affiliates")
    const affQuery = query(collection(db, 'affiliates'), where('userId', '==', user.uid));
    unsubAff = onSnapshot(affQuery, (snapshot) => {
      if (!snapshot.empty) {
        // User is an approved affiliate
        const docSnap = snapshot.docs[0];
        const affData = { id: docSnap.id, ...docSnap.data() };
        
        setAffiliate(affData);
        setApplication(null);

        // Set up nested sub-collection listeners for this affiliate
        const affId = docSnap.id;

        // 3.1. Listen to conversions (real-time sales)
        if (!unsubConv) {
          const convQuery = query(
            collection(db, 'affiliateConversions'),
            where('affiliateId', '==', affId),
            orderBy('createdAt', 'desc')
          );
          unsubConv = onSnapshot(convQuery, (convSnap) => {
            const convList = convSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setConversions(convList);
          }, (err) => {
            console.warn('[AffiliateContext] Conversions listener failed:', err.message);
          });
        }

        // 3.2. Listen to payout requests (withdrawals)
        if (!unsubPayouts) {
          const payoutQuery = query(
            collection(db, 'affiliatePayoutRequests'),
            where('affiliateId', '==', affId),
            orderBy('requestedAt', 'desc')
          );
          unsubPayouts = onSnapshot(payoutQuery, (payoutSnap) => {
            const payoutList = payoutSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPayouts(payoutList);
          }, (err) => {
            console.warn('[AffiliateContext] Payouts listener failed:', err.message);
          });
        }

        // 3.3. Listen to activity logs
        if (!unsubActivity) {
          const actQuery = query(
            collection(db, 'affiliateActivity'),
            where('affiliateId', '==', affId),
            orderBy('createdAt', 'desc'),
            limit(20)
          );
          unsubActivity = onSnapshot(actQuery, (actSnap) => {
            const actList = actSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setActivity(actList);
          }, (err) => {
            console.warn('[AffiliateContext] Activity listener failed:', err.message);
          });
        }

        affiliateDocLoaded = true;
        checkLoadingDone();
      } else {
        // Cleanup sub-listeners if user is not an approved affiliate or document deleted
        if (unsubConv) { unsubConv(); unsubConv = null; }
        if (unsubPayouts) { unsubPayouts(); unsubPayouts = null; }
        if (unsubActivity) { unsubActivity(); unsubActivity = null; }

        // User is not an approved affiliate — automatically create affiliate profile immediately!
        const autoCreate = async () => {
          try {
            const snap = await getDocs(collection(db, 'affiliates'));
            const nextIndex = snap.size + 1;
            const code = 'AFF' + String(nextIndex).padStart(3, '0');

            const newAffiliate = {
              userId: user.uid,
              affiliateCode: code,
              status: 'active',
              commissionRate: 30,
              totalClicks: 0,
              totalConversions: 0,
              totalRevenue: 0,
              totalCommission: 0,
              pendingCommission: 0,
              paidCommission: 0,
              createdAt: new Date().toISOString()
            };

            const docRef = doc(db, 'affiliates', user.uid);
            await setDoc(docRef, newAffiliate);

            // Update user document's role to Affiliate and set status flags
            const userDocRef = doc(db, 'users', user.uid);
            const userUpdates = {
              isApproved: true,
              isSuspended: false,
              canPromote: true
            };
            if (user?.role !== 'Admin') {
              userUpdates.role = 'Affiliate';
            }
            await updateDoc(userDocRef, userUpdates);

            if (user?.role !== 'Admin' && updateRole) {
              updateRole('Affiliate');
            }

            console.log('[AffiliateContext] Auto-created affiliate profile:', newAffiliate);
          } catch (err) {
            console.error('[AffiliateContext] Failed to auto-create affiliate profile:', err);
            setError(err.message);
          }
        };

        autoCreate();
        affiliateDocLoaded = true;
        checkLoadingDone();
      }
    }, (err) => {
      setError(err.message);
      affiliateDocLoaded = true;
      checkLoadingDone();
    });

    // 4. Listen to notifications (real-time, Phase 8)
    const notifsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    unsubNotifs = onSnapshot(notifsQuery, (snap) => {
      const list = snap.docs.map(d => ({ notifId: d.id, ...d.data() }));
      setNotifications(list);
    }, (err) => {
      console.error('[AffiliateContext] Notifications listener error:', err.message);
    });

    // Cleanup listeners
    return () => {
      if (unsubSettings) unsubSettings();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubAff) unsubAff();
      if (unsubConv) unsubConv();
      if (unsubPayouts) unsubPayouts();
      if (unsubActivity) unsubActivity();
      if (unsubNotifs) unsubNotifs();
    };
  }, [user]);

  const value = useMemo(() => ({
    loading,
    isApproved,
    isSuspended,
    canPromote,
    affiliateProgramEnabled,
    affiliateAllowed,
    affiliate,
    application,
    conversions,
    payouts,
    activity,
    error,
    notifications
  }), [
    loading,
    isApproved,
    isSuspended,
    canPromote,
    affiliateProgramEnabled,
    affiliateAllowed,
    affiliate,
    application,
    conversions,
    payouts,
    activity,
    error,
    notifications
  ]);

  return (
    <AffiliateContext.Provider value={value}>
      {children}
    </AffiliateContext.Provider>
  );
}
