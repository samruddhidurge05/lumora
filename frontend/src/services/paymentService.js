import { addDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// Record a payment transaction in Firestore
export const recordPayment = async (userId, orderId, amount, method, status = 'success') => {
  try {
    const paymentData = {
      userId,
      orderId,
      amount,
      method,
      status,
      created_at: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, 'payments'), paymentData);
    return { id: docRef.id, ...paymentData };
  } catch (error) {
    console.error('[paymentService] Error recording payment:', error);
    throw error;
  }
};

// Simulate payment processing (frontend simulation)
export const processPayment = async (paymentDetails) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        transactionId: `TXN_${Date.now()}`,
        ...paymentDetails,
      });
    }, 1500);
  });
};

// --- Admin Payment Services ---
import { backendFetch } from '../utils/api';

export const subscribeToPaymentsTelemetry = (callback) => {
  let ordersList = [];
  let vendorsList = [];
  let paymentsList = [];

  const handleUpdate = () => {
    // If we have actual SQL payments, map them to order stats expected by Payments.jsx
    const mappedOrders = paymentsList.map(p => {
      let statusVal = 'Pending';
      let payStatusVal = 'Unpaid';
      const s = (p.status || '').toUpperCase();
      if (s === 'SUCCESS') {
        statusVal = 'Completed';
        payStatusVal = 'Paid';
      } else if (s === 'REFUNDED') {
        statusVal = 'Refunded';
        payStatusVal = 'Refunded';
      } else if (s === 'FAILED') {
        statusVal = 'Failed';
        payStatusVal = 'Failed';
      } else if (s === 'REFUND_PENDING') {
        statusVal = 'Disputed';
        payStatusVal = 'Paid';
      }

      return {
        id: p.payment_ref || `pay-${p.id}`,
        orderId: p.order_id ? `ORD-${p.order_id}` : (p.gateway_order_id || '—'),
        price: p.amount || 0.0,
        status: statusVal,
        customerName: p.customer_name || `Customer #${p.customer_id}`,
        customerEmail: p.customer_email || '',
        vendorId: p.vendor_ids ? p.vendor_ids.split(',')[0] : 'v1',
        paymentStatus: payStatusVal,
        refundReason: p.refund_reason || '',
        paymentMethod: p.gateway || 'razorpay',
        createdAt: p.created_at || new Date().toISOString()
      };
    });

    callback({
      orders: mappedOrders.length > 0 ? mappedOrders : ordersList,
      vendors: vendorsList,
      loading: false
    });
  };

  const fetchPayments = async () => {
    try {
      const data = await backendFetch('/payments/admin/all?limit=200');
      if (data && data.payments) {
        paymentsList = data.payments;
        handleUpdate();
      }
    } catch (e) {
      console.warn('[paymentService] Failed to fetch SQL payments, falling back to Firestore orders:', e);
    }
  };

  fetchPayments();
  const pollInterval = setInterval(fetchPayments, 5000);

  const unsubOrders = onSnapshot(collection(db, 'orders'), (snap) => {
    ordersList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    handleUpdate();
  }, () => {
    // Firestore unavailable — rely on SQL payments already fetched above
    handleUpdate();
  });

  const unsubVendors = onSnapshot(collection(db, 'users'), (snap) => {
    const allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    vendorsList = allUsers.filter(u => u.role === 'vendor');
    handleUpdate();
  }, () => {
    // Firestore unavailable — vendor list stays empty, SQL payments drive the view
    handleUpdate();
  });

  return () => {
    unsubOrders();
    unsubVendors();
    clearInterval(pollInterval);
  };
};

export const calculatePaymentOverview = (orders) => {
  const list = orders || [];
  let totalRevenue = 0;
  let pendingRevenue = 0;
  let refundedAmount = 0;
  let successfulPayments = 0;
  let failedPayments = 0;

  list.forEach(o => {
    const amt = parseFloat(o.price || o.total || 0);
    const status = (o.status || '').toLowerCase();
    const payStatus = (o.paymentStatus || '').toLowerCase();

    if (payStatus === 'paid' || status === 'completed' || status === 'success') {
      totalRevenue += amt;
      successfulPayments += 1;
    } else if (status === 'pending') {
      pendingRevenue += amt;
    } else if (status === 'refunded') {
      refundedAmount += amt;
    } else if (status === 'failed' || status === 'cancelled') {
      failedPayments += 1;
    }
  });

  return {
    totalRevenue,
    pendingRevenue,
    refundedAmount,
    successfulPayments,
    failedPayments,
    totalTransactions: list.length
  };
};

export const calculateVendorPayouts = (orders, vendors) => {
  const ordersList = orders || [];
  const vendorsList = vendors || [];

  const vendorStats = {};
  ordersList.forEach(o => {
    const vendorId = o.vendorId || 'unknown';
    const amt = parseFloat(o.price || o.total || 0);
    const status = (o.status || '').toLowerCase();
    const payStatus = (o.paymentStatus || '').toLowerCase();

    if (payStatus === 'paid' || status === 'completed' || status === 'success') {
      if (!vendorStats[vendorId]) {
        vendorStats[vendorId] = { totalSales: 0, count: 0 };
      }
      vendorStats[vendorId].totalSales += amt;
      vendorStats[vendorId].count += 1;
    }
  });

  const payouts = vendorsList.map(v => {
    const stats = vendorStats[v.uid || v.id] || { totalSales: 0 };
    const totalSales = stats.totalSales;
    const commission = totalSales * 0.1; // 10% platform commission
    const paidPayout = totalSales * 0.7; // 70% paid out
    const pendingPayout = totalSales * 0.2; // 20% pending
    return {
      vendorId: v.uid || v.id,
      vendorName: v.fullName || v.name || 'Vendor',
      totalSales,
      commission,
      paidPayout,
      pendingPayout
    };
  });

  return payouts;
};

export const getRefundMonitorList = (orders) => {
  const list = orders || [];
  const refunds = [];

  list.forEach(o => {
    const status = (o.status || '').toLowerCase();
    if (status === 'refunded' || o.refundReason || status === 'disputed') {
      refunds.push({
        id: o.id || `ref-${refunds.length}`,
        orderId: o.orderId || o.id || 'N/A',
        amount: parseFloat(o.price || o.total || 0),
        customerName: o.customerName || o.customerEmail || 'Customer',
        status: o.status === 'Refunded' ? 'Approved' : (o.status === 'Disputed' ? 'Pending' : 'Approved'),
        refundReason: o.refundReason || 'Customer refund request'
      });
    }
  });

  return refunds;
};

export const triggerVendorPayout = async (vendorId, amount) => {
  try {
    return await backendFetch('/admin/payments/payout', {
      method: 'POST',
      body: JSON.stringify({ vendor_id: vendorId, amount: amount })
    });
  } catch (error) {
    console.error('[paymentService] Error triggering vendor payout:', error);
    throw error;
  }
};


