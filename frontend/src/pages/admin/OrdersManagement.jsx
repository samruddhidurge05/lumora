import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from './components/AdminLayout';
import { PageHeader, StatsGrid, DashboardCard, GlassCard, FilterBar, TableContainer } from './components/AdminComponents';
import {
  fetchAllOrders,
  updateOrderStatus,
  refundOrder as firestoreRefundOrder,
  disputeOrder as firestoreDisputeOrder,
} from '../../services/orderService.js';
import {
  generateDownloadLink,
  getDownloadErrorMessage,
} from '../../services/downloadService.js';

// --- ROBUST SELF-CONTAINED LUXURY UI VECTOR SYSTEM ---
const Icon = ({ name, size = 16, className = "" }) => {
  const svgs = {
    Search: <path d="M19 11a8 8 0 11-16 0 8 8 0 0116 0zM21 21l-4.35-4.35" />,
    Plus: <path d="M12 5v14M5 12h14" />,
    Grid: <g><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></g>,
    List: <g><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></g>,
    TrendingUp: <g><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></g>,
    Layers: <g><polygon points="12 2 2 7 12 12 22 7 12 2" /><polygon points="2 17 12 22 22 17" /><polygon points="2 12 12 17 22 12" /></g>,
    Download: <g><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></g>,
    DollarSign: <g><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></g>,
    Award: <g><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></g>,
    Tag: <g><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></g>,
    Folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
    Trash2: <g><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></g>,
    Edit2: <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />,
    Check: <polyline points="20 6 9 17 4 12" />,
    X: <g><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></g>,
    Eye: <g><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></g>,
    Activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    Globe: <g><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g>,
    Copy: <g><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></g>,
    ArrowUpRight: <g><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></g>,
    ChevronDown: <polyline points="6 9 12 15 18 9" />,
    Sliders: <g><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></g>,
    Compass: <g><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></g>,
    Play: <polygon points="5 3 19 12 5 21 5 3" />,
    Pause: <g><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></g>,
    Star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
    ChevronLeft: <polyline points="15 18 9 12 15 6" />,
    ChevronRight: <polyline points="9 18 15 12 9 6" />,
    Volume2: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></g>,
    VolumeX: <g><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></g>,
    AlertTriangle: <g><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></g>,
    CheckCircle: <g><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></g>,
    RefreshCw: <g><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></g>,
    FileText: <g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></g>,
    Filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
    ArrowDown: <g><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></g>
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {svgs[name] || null}
    </svg>
  );
};

// --- SYSTEM AUDIO ENGINE (Procedural Luxury UI Sound System) ---
class AudioController {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }
  playTap() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1100, this.ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }
  playSwoosh() {
    if (this.muted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
  playSuccess() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const playNote = (freq, start, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.02, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    playNote(659.25, now, 0.12); // E5
    playNote(880.00, now + 0.06, 0.2);  // A5
  }
}

const sysSound = new AudioController();

// Helper: derive a display-friendly product name from a Firestore order
// Firestore orders use an `items` array; old mock orders use `productName`.
const getProductName = (o) => {
  if (o.productName) return o.productName;
  if (o.items && o.items.length > 0) {
    const names = o.items.map(i => i.snapshot?.title || 'Unknown').join(', ');
    return o.items.length > 1 ? `${o.items[0].snapshot?.title || 'Unknown'} +${o.items.length - 1} more` : names;
  }
  return o.productSnapshot?.title || 'Unknown Product';
};

// Helper: derive a product type from a Firestore order
const getProductType = (o) => {
  if (o.productType) return o.productType;
  if (o.items && o.items.length > 0) return o.items[0].snapshot?.category || 'Asset';
  return o.productSnapshot?.category || 'Asset';
};

// Helper: get effective price for display (supports both new `total` and old `price` fields)
const getOrderPrice = (o) => o.total ?? o.price ?? 0;

// Helper: riskScore — Firestore orders don't have one, default to 0
const getRiskScore = (o) => o.riskScore ?? 0;

export default function OrdersManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("All");
  const [selectedProductType, setSelectedProductType] = useState("All");
  const [sortBy, setSortBy] = useState("newest"); // newest | value-desc | risk-desc

  // App UI configuration
  const [audioMuted, setAudioMuted] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [activeTooltip, setActiveTooltip] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [bulkRefundOpen, setBulkRefundOpen] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [notification, setNotification] = useState(null);

  // Download state — keyed by order Firestore doc ID
  const [downloadLoading, setDownloadLoading] = useState({});   // { [orderId]: boolean }
  const [downloadError, setDownloadError]     = useState({});   // { [orderId]: string|null }

  // Responsive Drawer State
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);




  // --- FIRESTORE DATA LOADER ---
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchAllOrders();
      setOrders(data);
      if (data.length > 0) setSelectedOrderId(data[0].id);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setLoadError('Failed to load orders. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);



  // Procedural audio synchronization
  useEffect(() => {
    sysSound.muted = audioMuted;
  }, [audioMuted]);

  // Toast utility
  const triggerNotification = (text, type = "success") => {
    setNotification({ text, type });
    if (type === "success") sysSound.playSuccess();
    else sysSound.playTap();
    setTimeout(() => setNotification(null), 4000);
  };



  // --- ORDER INTELLIGENCE COMPUTATIONS (Phase D: real Firestore data) ---
  const statistics = useMemo(() => {
    let totalRevenue    = 0;
    let refundedAmount  = 0;
    let pendingOrders   = 0;
    let completedOrders = 0;
    let highRiskCount   = 0;

    orders.forEach(o => {
      const price = getOrderPrice(o);
      const risk  = getRiskScore(o);

      // Revenue: only count Paid orders that haven't been refunded
      if (o.paymentStatus === "Paid" && o.status !== "Refunded") {
        totalRevenue += price;
      }
      if (o.status === "Refunded") {
        refundedAmount += price;
      }
      if (o.status === "Pending" || o.status === "Processing") {
        pendingOrders++;
      }
      if (o.status === "Completed") {
        completedOrders++;
      }
      if (risk >= 75) {
        highRiskCount++;
      }
    });

    const processingOrders = orders.filter(o => o.status === "Processing").length;
    const successRate = orders.length > 0
      ? Math.round(((completedOrders + processingOrders) / orders.length) * 100)
      : 100;

    const paidOrders = orders.filter(o => o.paymentStatus === "Paid" && o.status !== "Refunded");
    const aov = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

    return {
      totalRevenue,
      totalOrders: orders.length,
      refundedAmount,
      pendingOrders,
      successRate,
      aov,
      highRiskCount
    };
  }, [orders]);

  // --- FILTERS & SEARCH PIPELINE ---
  const processedOrders = useMemo(() => {
    let list = [...orders];

    // Search query matches Customer Name, Email, Order ID, Product Name
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o =>
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.customerEmail || '').toLowerCase().includes(q) ||
        (o.id || '').toLowerCase().includes(q) ||
        (o.orderId || '').toLowerCase().includes(q) ||
        getProductName(o).toLowerCase().includes(q)
      );
    }

    // Dropdown filters
    if (selectedStatus !== "All") {
      list = list.filter(o => o.status === selectedStatus);
    }
    if (selectedPaymentStatus !== "All") {
      list = list.filter(o => o.paymentStatus === selectedPaymentStatus);
    }
    if (selectedProductType !== "All") {
      list = list.filter(o => getProductType(o) === selectedProductType);
    }

    // Sort mappings
    if (sortBy === "newest") {
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === "value-desc") {
      list.sort((a, b) => getOrderPrice(b) - getOrderPrice(a));
    } else if (sortBy === "risk-desc") {
      list.sort((a, b) => getRiskScore(b) - getRiskScore(a));
    }

    return list;
  }, [orders, searchQuery, selectedStatus, selectedPaymentStatus, selectedProductType, sortBy]);

  // Currently focused order
  const selectedOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || processedOrders[0] || null;
  }, [orders, selectedOrderId, processedOrders]);

  // Sync selected order in case the search removes the currently selected ID
  useEffect(() => {
    if (processedOrders.length > 0 && (!selectedOrderId || !processedOrders.find(o => o.id === selectedOrderId))) {
      setSelectedOrderId(processedOrders[0].id);
    }
  }, [processedOrders, selectedOrderId]);

  // --- ORDER STATE HANDLERS (Phase C: Firestore-backed) ---
  const handleUpdateStatus = async (orderId, newStatus) => {
    // Optimistic update — UI reflects change immediately
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        let paymentStat = o.paymentStatus;
        if (newStatus === "Completed") paymentStat = "Paid";
        if (newStatus === "Refunded")  paymentStat = "Refunded";
        return {
          ...o,
          status:         newStatus,
          paymentStatus:  paymentStat,
          revenue:        newStatus === "Refunded" ? 0 : getOrderPrice(o),
          vendorEarnings: newStatus === "Refunded" ? 0 : parseFloat((getOrderPrice(o) * 0.95).toFixed(2)),
        };
      }
      return o;
    }));

    try {
      await updateOrderStatus(orderId, newStatus);
      triggerNotification(`Order ${orderId} status set to ${newStatus}`);
    } catch (err) {
      console.error('Status update failed:', err);
      triggerNotification(`Failed to update order status`, "warning");
      // Reload from Firestore to restore accurate state
      loadOrders();
    }
  };

  const handleRefundOrder = async (orderId) => {
    // Optimistic update
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status:         "Refunded",
          paymentStatus:  "Refunded",
          revenue:        0,
          platformFee:    0,
          vendorEarnings: 0,
        };
      }
      return o;
    }));

    try {
      await firestoreRefundOrder(orderId);
      triggerNotification(`Refunded order ${orderId} successfully`, "info");
    } catch (err) {
      console.error('Refund failed:', err);
      triggerNotification(`Failed to process refund`, "warning");
      loadOrders();
    }
  };

  const handleFlagDispute = async (orderId) => {
    // Optimistic update
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, status: "Disputed", riskScore: Math.min(getRiskScore(o) + 20, 100) };
      }
      return o;
    }));

    try {
      await firestoreDisputeOrder(orderId);
      triggerNotification(`Dispute flagged on order ${orderId}`, "warning");
    } catch (err) {
      console.error('Dispute flag failed:', err);
      triggerNotification(`Failed to flag dispute`, "warning");
      loadOrders();
    }
  };

  const handleRetryPayment = async (orderId) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          status:         "Completed",
          paymentStatus:  "Paid",
          revenue:        getOrderPrice(o),
          platformFee:    parseFloat((getOrderPrice(o) * 0.05).toFixed(2)),
          vendorEarnings: parseFloat((getOrderPrice(o) * 0.95).toFixed(2)),
        };
      }
      return o;
    }));

    try {
      await updateOrderStatus(orderId, "Completed");
      triggerNotification(`Payment retry successful. Asset delivered.`);
    } catch (err) {
      console.error('Retry payment failed:', err);
      loadOrders();
    }
  };

  const handleCopyLink = (text) => {
    navigator.clipboard.writeText(text);
    triggerNotification("Asset download link copied to clipboard");
  };

  // ── Secure download handler ──────────────────────────────────────────────────
  // Admin panel: pass null as userId so ownership check is bypassed.
  // The function still enforces paymentStatus === "Paid" and downloadGranted === true.
  const handleDownload = useCallback(async (order) => {
    const orderId = order.id;

    // Clear any previous error for this order
    setDownloadError(prev => ({ ...prev, [orderId]: null }));
    setDownloadLoading(prev => ({ ...prev, [orderId]: true }));

    try {
      // Admin context: pass null for userId to skip ownership check
      const result = await generateDownloadLink(orderId, null);

      // Trigger browser download via a temporary anchor element
      const a      = document.createElement('a');
      a.href       = result.downloadUrl;
      a.download   = result.fileName || 'product.zip';
      a.target     = '_blank';
      a.rel        = 'noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      triggerNotification(`Download started: ${result.fileName}`);
    } catch (err) {
      console.error('[OrdersManagement] Download error:', err);
      const msg = getDownloadErrorMessage(err.code);
      setDownloadError(prev => ({ ...prev, [orderId]: msg }));
      triggerNotification(msg, 'warning');
    } finally {
      setDownloadLoading(prev => ({ ...prev, [orderId]: false }));
    }
  }, []);

  // Trigger floating active risk scan simulation
  const handleTriggerScan = () => {
    sysSound.playSwoosh();
    setIsScanning(true);
    setScanProgress(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 8;
      if (current >= 100) {
        clearInterval(interval);
        setIsScanning(false);
        setOrders(prev => prev.map(o => {
          // Identify suspicious email patterns or high price regions to simulate security flag updates
          if (o.customerEmail?.includes(".edu") && o.status === "Pending") {
            return { ...o, riskScore: Math.min(getRiskScore(o) + 15, 98) };
          }
          return o;
        }));
        triggerNotification("Security audit scan complete. Anomaly logs updated.", "success");
      } else {
        setScanProgress(current);
      }
    }, 150);
  };

  // Export order ledger to CSV using real Firestore data
  const handleExportCSV = () => {
    sysSound.playTap();
    setExporting(true);

    try {
      const headers = ['Order ID', 'Customer Name', 'Email', 'Product', 'Price', 'Status', 'Payment Status', 'Created At'];
      const rows = orders.map(o => [
        o.orderId || o.id,
        o.customerName || '',
        o.customerEmail || '',
        getProductName(o),
        getOrderPrice(o),
        o.status,
        o.paymentStatus,
        o.createdAt || '',
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lumora-orders-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      triggerNotification(`Exported ${orders.length} order records to CSV successfully`);
    } catch (err) {
      console.error('CSV export failed:', err);
      triggerNotification('CSV export failed', 'warning');
    } finally {
      setExporting(false);
    }
  };

  const handleToggleRowSelection = (id) => {
    setSelectedRowIds(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  const handleBulkRefund = async () => {
    if (selectedRowIds.length === 0) return;

    // Optimistic update
    setOrders(prev => prev.map(o => {
      if (selectedRowIds.includes(o.id)) {
        return {
          ...o,
          status:         "Refunded",
          paymentStatus:  "Refunded",
          revenue:        0,
          platformFee:    0,
          vendorEarnings: 0,
        };
      }
      return o;
    }));

    const count = selectedRowIds.length;
    setBulkRefundOpen(false);
    setSelectedRowIds([]);

    try {
      await Promise.all(selectedRowIds.map(id => firestoreRefundOrder(id)));
      triggerNotification(`Bulk refunded ${count} orders`);
    } catch (err) {
      console.error('Bulk refund failed:', err);
      triggerNotification('Some refunds failed — reloading orders', 'warning');
      loadOrders();
    }
  };

  // Magnetic Hover script for specific CTA elements
  const handleMagneticMove = (e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate3d(${x * 0.2}px, ${y * 0.2}px, 0)`;
  };

  const handleMagneticLeave = (e) => {
    e.currentTarget.style.transform = 'translate3d(0px, 0px, 0)';
  };

  return (
    <AdminLayout activePage="orders">

      {/* TOAST SYSTEM */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 left-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_12px_40px_rgba(90,30,126,0.08)]"
          >
            <div className={`w-2.5 h-2.5 rounded-full ${
              notification.type === 'warning' ? 'bg-[#D8BFE3] shadow-[0_0_8px_#D8BFE3]' :
              notification.type === 'info' ? 'bg-[#D8BFE3] shadow-[0_0_8px_#D8BFE3]' :
              'bg-[#B886D0] shadow-[0_0_8px_#B886D0]'
            }`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#2D004D]">{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTAINER */}
      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

        {/* Loading / Error states */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2 border-[#D8BFE3] border-t-[#7B3FA0]"
            />
            <p className="text-xs font-bold text-[#7B3FA0] uppercase tracking-widest">Loading order ledger...</p>
          </div>
        )}

        {!loading && loadError && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <p className="text-sm font-bold text-red-400">{loadError}</p>
            <button onClick={loadOrders} className="px-5 py-2 rounded-xl bg-[#2D004D] text-white text-xs font-bold">Retry</button>
          </div>
        )}

        {!loading && !loadError && (
        <>

        {/* --- PAGE HEADER --- */}
        <PageHeader
          title="Order Command Board"
          subtitle="Audit platform transactions, verify customer checkouts, flag operational risk anomalies, and issue refunds."
        />

        {/* --- TOP CONTROL STRIP (Metrics Engine) --- */}
        <StatsGrid columns={4}>
          
          {/* CARD 1: REVENUE */}
          <DashboardCard
            title="Total Revenue"
            value={`₹${statistics.totalRevenue.toLocaleString()}`}
            icon={<Icon name="DollarSign" size={14} />}
            trend="+8.2%"
            trendLabel=""
            chart={
              <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                <path 
                  d="M0,15 Q15,5 30,12 T60,4 T90,14 L100,10" 
                  fill="none" 
                  stroke="#D8BFE3" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                />
                <circle cx="100" cy="10" r="2.5" fill="#B886D0" />
              </svg>
            }
          />

          {/* CARD 2: ACTIVE VOLUME */}
          <DashboardCard
            title="Active Volume"
            value={statistics.totalOrders}
            icon={<Icon name="Activity" size={14} />}
            trend={`${statistics.pendingOrders} pending`}
            trendLabel=""
            chart={
              <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                <path 
                  d="M0,18 L15,14 L30,16 L45,8 L60,12 L75,4 L90,10 L100,6" 
                  fill="none" 
                  stroke="#D8BFE3" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                />
                <circle cx="100" cy="6" r="2.5" fill="#D8BFE3" />
              </svg>
            }
          />

          {/* CARD 3: FULFILLMENT */}
          <DashboardCard
            title="Fulfillment"
            value={`${statistics.successRate}%`}
            icon={<Icon name="CheckCircle" size={14} />}
            trend={`₹${statistics.refundedAmount} refunded`}
            trendLabel=""
            chart={
              <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                <path 
                  d="M0,5 L20,6 L40,4 L60,8 L80,10 L100,12" 
                  fill="none" 
                  stroke="#B886D0" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                />
                <circle cx="100" cy="12" r="2.5" fill="#B886D0" />
              </svg>
            }
          />

          {/* CARD 4: RISK ALERTS */}
          <DashboardCard
            title="Risk Alerts"
            value={statistics.highRiskCount}
            icon={
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${statistics.highRiskCount > 0 ? 'bg-[#D8BFE3]/40 text-[#FF8597] animate-pulse' : 'text-[#7B3FA0]'}`}>
                <Icon name="AlertTriangle" size={14} />
              </div>
            }
            trend="risk score >75"
            trendLabel=""
          />
        </StatsGrid>

        {/* --- GRID SYSTEM: LEDGER & INSIGHTS --- */}
        <section className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
          
          {/* LEFT 60% PANEL: THE LEDGER */}
          <div className="lg:col-span-6 flex flex-col gap-6">

            {/* FILTER STRIP & SEARCH CONTROL */}
            <FilterBar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search by customer, email, product..."
              filters={[
                // Sort control dropdown
                <div key="sort" className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-[#7B3FA0] tracking-wider uppercase">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      sysSound.playTap();
                      setSortBy(e.target.value);
                    }}
                    className="bg-white/60 border border-stone-200 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#2D004D] focus:outline-none"
                  >
                    <option value="newest">Newest Logged</option>
                    <option value="value-desc">Highest Revenue</option>
                    <option value="risk-desc">Highest Risk Index</option>
                  </select>
                </div>,
                // Status selector dropdown
                <div key="status" className="relative">
                  <select 
                    value={selectedStatus}
                    onChange={(e) => {
                      sysSound.playTap();
                      setSelectedStatus(e.target.value);
                    }}
                    className="bg-stone-100/50 border border-stone-200/50 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#7B3FA0] focus:outline-none cursor-pointer"
                  >
                    <option value="All">Status: All</option>
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="Completed">Completed</option>
                    <option value="Failed">Failed</option>
                    <option value="Refunded">Refunded</option>
                    <option value="Disputed">Disputed</option>
                  </select>
                </div>,
                // Payment status selector dropdown
                <div key="paymentStatus" className="relative">
                  <select 
                    value={selectedPaymentStatus}
                    onChange={(e) => {
                      sysSound.playTap();
                      setSelectedPaymentStatus(e.target.value);
                    }}
                    className="bg-stone-100/50 border border-stone-200/50 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#7B3FA0] focus:outline-none cursor-pointer"
                  >
                    <option value="All">Payment: All</option>
                    <option value="Paid">Paid</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Refunded">Refunded</option>
                  </select>
                </div>,
                // Product Type selector dropdown
                <div key="type" className="relative">
                  <select 
                    value={selectedProductType}
                    onChange={(e) => {
                      sysSound.playTap();
                      setSelectedProductType(e.target.value);
                    }}
                    className="bg-stone-100/50 border border-stone-200/50 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#7B3FA0] focus:outline-none cursor-pointer"
                  >
                    <option value="All">Type: All</option>
                    <option value="Asset">Asset</option>
                    <option value="Template">Template</option>
                    <option value="Course">Course</option>
                    <option value="UI Kit">UI Kit</option>
                  </select>
                </div>
              ]}
              actions={
                (selectedStatus !== "All" || selectedPaymentStatus !== "All" || selectedProductType !== "All" || searchQuery) && (
                  <button 
                    onClick={() => {
                      sysSound.playTap();
                      setSearchQuery("");
                      setSelectedStatus("All");
                      setSelectedPaymentStatus("All");
                      setSelectedProductType("All");
                    }}
                    className="text-[10px] font-bold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                  >
                    <Icon name="RefreshCw" size={9} />
                    Reset Parameters
                  </button>
                )
              }
            />

            {/* THE LEDGER RECORD TABLE */}
            <TableContainer>
              
              <div className="overflow-x-auto w-full">
                
                {processedOrders.length > 0 ? (
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-stone-100/40 border-b border-stone-200/50">
                        <th className="py-4 px-5 w-10">
                          <input 
                            type="checkbox"
                            checked={selectedRowIds.length === processedOrders.length}
                            onChange={(e) => {
                              sysSound.playTap();
                              if (e.target.checked) {
                                setSelectedRowIds(processedOrders.map(o => o.id));
                              } else {
                                setSelectedRowIds([]);
                              }
                            }}
                            className="rounded border-stone-300 accent-[#D8BFE3]"
                          />
                        </th>
                        <th className="py-4 px-4 text-[9px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Order ID</th>
                        <th className="py-4 px-4 text-[9px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Customer</th>
                        <th className="py-4 px-4 text-[9px] font-extrabold tracking-widest text-[#7B3FA0] uppercase text-right">Value</th>
                        <th className="py-4 px-4 text-[9px] font-extrabold tracking-widest text-[#7B3FA0] uppercase text-center">Status</th>
                        <th className="py-4 px-4 text-[9px] font-extrabold tracking-widest text-[#7B3FA0] uppercase text-center w-24">Risk</th>
                        <th className="py-4 px-5 text-[9px] font-extrabold tracking-widest text-[#7B3FA0] uppercase text-center w-12">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {processedOrders.map((o) => {
                          const isFocused = selectedOrder?.id === o.id;
                          const isChecked = selectedRowIds.includes(o.id);
                          
                          // Custom status colors
                          const statusStyles = {
                            Completed: "bg-[#B886D0]/40 text-[#5A1E7E] border-[#B886D0]/80 shadow-[0_0_8px_rgba(184,134,208,0.3)]",
                            Processing: "bg-[#D8BFE3]/40 text-[#47607a] border-[#D8BFE3]/80 shadow-[0_0_8px_rgba(216,191,227,0.3)]",
                            Pending: "bg-[#D8BFE3]/40 text-[#7a5940] border-[#D8BFE3]/80 shadow-[0_0_8px_rgba(216,191,227,0.3)]",
                            Failed: "bg-[#D8BFE3]/40 text-[#8c4854] border-[#D8BFE3]/80 shadow-[0_0_8px_rgba(184,134,208,0.3)]",
                            Refunded: "bg-stone-100 text-stone-500 border-stone-200",
                            Disputed: "bg-[#D8BFE3] text-[#FF8597] border-[#FF8597]/20 shadow-[0_0_8px_rgba(255,133,151,0.2)] animate-pulse"
                          };

                          return (
                            <motion.tr
                              key={o.id}
                              layoutId={`row-${o.id}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className={`border-b border-stone-200/40 transition-all duration-300 hover:bg-white/65 cursor-pointer ${
                                isFocused ? 'bg-white/90 shadow-[inset_3px_0_0_#D8BFE3]' : ''
                              }`}
                              onClick={() => {
                                sysSound.playTap();
                                setSelectedOrderId(o.id);
                              }}
                            >
                              {/* Checkbox select */}
                              <td className="py-4 px-5" onClick={(e) => e.stopPropagation()}>
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    sysSound.playTap();
                                    handleToggleRowSelection(o.id);
                                  }}
                                  className="rounded border-stone-300 accent-[#D8BFE3]"
                                />
                              </td>

                              {/* Order ID */}
                              <td className="py-4 px-4 font-mono text-[11px] font-bold text-[#2D004D]">
                                {o.id}
                              </td>

                              {/* Customer name / email summary */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-full bg-white border border-stone-200/50 flex items-center justify-center text-[10px] font-black uppercase text-[#7B3FA0] shadow-inner">
                                    {o.customerName.slice(0, 2)}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-[#2D004D]">{o.customerName}</span>
                                    <span className="text-[10px] text-[#7B3FA0] leading-none mt-0.5">{o.customerEmail}</span>
                                  </div>
                                </div>
                              </td>

                              {/* Price */}
                              <td className="py-4 px-4 text-right">
                                <div className="flex flex-col">
                                  <span className="text-xs font-black text-[#2D004D]">₹{getOrderPrice(o)}</span>
                                  <span className="text-[8px] text-[#8E6AA8] uppercase font-bold tracking-widest">{getProductType(o)}</span>
                                </div>
                              </td>

                              {/* Status pill with animated glow sweep */}
                              <td className="py-4 px-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[9px] font-extrabold uppercase tracking-widest transition-all duration-300 ${statusStyles[o.status] || "bg-stone-100"}`}>
                                  {o.status}
                                </span>
                              </td>

                              {/* Risk bar */}
                              <td className="py-4 px-4 text-center w-24">
                                <div className="flex flex-col gap-1 w-full max-w-[80px] mx-auto">
                                  <div className="flex justify-between text-[8px] font-bold text-[#7B3FA0]">
                                    <span>RISK INDEX</span>
                                    <span className={getRiskScore(o) >= 75 ? 'text-[#FF8597]' : ''}>{getRiskScore(o)}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200/20">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        getRiskScore(o) >= 75 ? 'bg-gradient-to-r from-[#FF8597] to-[#FF556B]' :
                                        getRiskScore(o) >= 40 ? 'bg-gradient-to-r from-[#D8BFE3] to-[#ffb685]' :
                                        'bg-gradient-to-r from-[#B886D0] to-[#a2d8b1]'
                                      }`}
                                      style={{ width: `${getRiskScore(o)}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Quick Row Actions Dropdown */}
                              <td className="py-4 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="relative group/actions inline-block">
                                  <button className="p-1 rounded-lg hover:bg-stone-100 text-[#7B3FA0] hover:text-[#2D004D] transition-colors">
                                    <Icon name="Sliders" size={13} />
                                  </button>
                                  <div className="absolute right-0 top-6 w-36 bg-white/95 backdrop-blur-xl border border-stone-200/50 shadow-xl rounded-xl py-2 hidden group-hover/actions:block z-20 pointer-events-auto">
                                    <button 
                                      onClick={() => handleUpdateStatus(o.id, "Processing")}
                                      className="w-full text-left px-4 py-1.5 text-[10px] font-bold hover:bg-stone-50 text-[#7B3FA0] hover:text-[#2D004D]"
                                    >
                                      Mark Processing
                                    </button>
                                    <button 
                                      onClick={() => handleUpdateStatus(o.id, "Completed")}
                                      className="w-full text-left px-4 py-1.5 text-[10px] font-bold hover:bg-stone-50 text-[#7B3FA0] hover:text-[#2D004D]"
                                    >
                                      Mark Completed
                                    </button>
                                    <button 
                                      onClick={() => handleFlagDispute(o.id)}
                                      className="w-full text-left px-4 py-1.5 text-[10px] font-bold hover:bg-stone-50 text-[#FF8597]"
                                    >
                                      Flag Dispute
                                    </button>
                                    <button 
                                      onClick={() => handleRefundOrder(o.id)}
                                      className="w-full text-left px-4 py-1.5 text-[10px] font-bold hover:bg-stone-50 text-stone-500 border-t border-stone-100"
                                    >
                                      Refund Transaction
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                ) : (
                  
                  // Empty state visual system
                  <div className="py-20 flex flex-col items-center justify-center text-center px-6">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                      className="w-20 h-20 rounded-full border border-dashed border-[#D8BFE3] flex items-center justify-center mb-6"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#D8BFE3]/30 to-[#D8BFE3]/30 backdrop-blur-md flex items-center justify-center">
                        <span className="text-[#7B3FA0] text-lg">✧</span>
                      </div>
                    </motion.div>
                    <h4 className="text-sm font-serif font-bold text-[#2D004D] mb-1">Your order universe is quiet... for now</h4>
                    <p className="text-[10px] text-[#7B3FA0] max-w-sm mb-6 leading-relaxed">No matching transactions detected within this dimension. Clear filters or inject mock records to revive telemetry.</p>
                    <button 
                      onClick={() => {
                        sysSound.playSuccess();
                        loadOrders();
                      }}
                      className="btn-premium px-5 py-2.5 rounded-full text-[10px] font-bold tracking-widest uppercase border-none cursor-pointer"
                    >
                      Reload Orders from Firestore
                    </button>
                  </div>

                )}

              </div>

            </TableContainer>

          </div>

          {/* RIGHT 40% PANEL: TRANSACTION DETAILS & ANOMALY ANALYSIS */}
          <div className="lg:col-span-4 glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col gap-6 sticky top-24">
            
            {selectedOrder ? (
              <div className="flex flex-col gap-6">
                
                {/* Customer Profile Header Section */}
                <div className="flex justify-between items-start border-b border-stone-200/50 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#D8BFE3] to-[#D8BFE3] flex items-center justify-center text-sm font-black text-[#2D004D] shadow-[0_4px_12px_rgba(216,191,227,0.25)]">
                      {(selectedOrder.customerName || 'UN').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-serif font-black text-[#2D004D] tracking-wide">{selectedOrder.customerName}</span>
                      <span className="text-[10px] text-[#7B3FA0] font-mono mt-0.5">{selectedOrder.customerEmail}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-mono font-bold text-[#7B3FA0]">{selectedOrder.orderId || selectedOrder.id}</span>
                    <span className="text-[8px] text-[#8E6AA8] font-bold mt-1 uppercase tracking-widest bg-stone-100 px-2 py-0.5 rounded">
                      {selectedOrder.customerInfo?.country || selectedOrder.region || 'Global'}
                    </span>
                  </div>
                </div>

                {/* Delivery Information Section */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-[9px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Fulfillment Logistics</h4>
                  <div className="bg-white/60 border border-[#F3EAF8] p-4 rounded-2xl flex flex-col gap-3.5 shadow-sm">
                    
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] text-[#7B3FA0] font-medium">Delivery Type</span>
                      <span className="font-bold text-[#2D004D] text-[10px] uppercase tracking-wider">{selectedOrder.deliveryType || 'Instant Download'}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] text-[#7B3FA0] font-medium">Product License</span>
                      <span className="font-mono text-[10px] text-[#2D004D] bg-white border border-stone-200/50 px-2 py-0.5 rounded shadow-sm">
                        LUM-KEY-{(selectedOrder.orderId || selectedOrder.id || '').slice(-4)}-{(selectedOrder.createdAt || '').slice(5, 7)}
                      </span>
                    </div>

                    {selectedOrder.status !== "Refunded" && selectedOrder.status !== "Failed" ? (
                      <div className="flex flex-col gap-2 mt-2">
                        {/* Download access gate: only show active buttons when payment is confirmed */}
                        {selectedOrder.downloadGranted && selectedOrder.paymentStatus === "Paid" ? (
                          <div className="flex gap-2.5">
                            <button 
                              onClick={() => {
                                // Copy the real Storage downloadUrl if available, otherwise a placeholder note
                                const url = selectedOrder.items?.[0]
                                  ? `Order ${selectedOrder.orderId || selectedOrder.id} — use Download button to access file`
                                  : '';
                                handleCopyLink(url || selectedOrder.orderId || selectedOrder.id);
                              }}
                              className="flex-1 py-2 bg-white hover:bg-stone-50 border border-stone-200/70 hover:border-[#D8BFE3] rounded-xl text-[10px] font-bold text-[#2D004D] flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Icon name="Copy" size={11} />
                              Copy Order ID
                            </button>
                            <button
                              onClick={() => handleDownload(selectedOrder)}
                              disabled={downloadLoading[selectedOrder.id]}
                              className="flex-1 py-2 bg-[#2D004D] hover:bg-[#7B3FA0] disabled:bg-stone-300 disabled:cursor-not-allowed rounded-xl text-[10px] font-bold text-white flex items-center justify-center gap-1.5 transition-colors"
                            >
                              {downloadLoading[selectedOrder.id] ? (
                                <>
                                  <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                  </svg>
                                  Verifying...
                                </>
                              ) : (
                                <>
                                  <Icon name="Download" size={11} />
                                  Download File
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          /* Payment not confirmed — download locked */
                          <div className="py-2.5 px-4 bg-amber-50 border border-amber-200/60 rounded-xl text-center text-[10px] font-bold text-amber-700 mt-1">
                            🔒 Download locked — payment not confirmed.
                          </div>
                        )}

                        {/* Download error message */}
                        {downloadError[selectedOrder.id] && (
                          <div className="py-2 px-3 bg-red-50 border border-red-200/60 rounded-xl text-[9px] font-bold text-red-600">
                            ⚠ {downloadError[selectedOrder.id]}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-2.5 px-4 bg-[#D8BFE3]/20 border border-[#D8BFE3]/40 rounded-xl text-center text-[10px] font-bold text-[#8C4854] mt-1">
                        Delivery disabled: Transaction is not active.
                      </div>
                    )}

                  </div>
                </div>

                {/* Financial Ledger Details */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-[9px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Transaction Ledger</h4>
                  <div className="bg-white/60 border border-[#F3EAF8] p-4 rounded-2xl flex flex-col gap-2.5 shadow-sm">
                    
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] text-[#7B3FA0]">Gross Product Value</span>
                      <span className="font-bold text-[#2D004D]">₹{getOrderPrice(selectedOrder).toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] text-[#7B3FA0]">Lumora Platform Fee (5%)</span>
                      <span className="font-bold text-[#8C4854]">-₹{(selectedOrder.platformFee ?? parseFloat((getOrderPrice(selectedOrder) * 0.05).toFixed(2))).toFixed(2)}</span>
                    </div>

                    <div className="h-px bg-stone-200/50 my-1" />

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[10px] text-[#7B3FA0] font-bold">Net Creator Earnings</span>
                      <span className="font-black text-[#5A1E7E] text-sm">₹{(selectedOrder.vendorEarnings ?? parseFloat((getOrderPrice(selectedOrder) * 0.95).toFixed(2))).toFixed(2)}</span>
                    </div>

                  </div>
                </div>

                {/* Security Anomaly Analysis */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-[9px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Security & Risk Matrix</h4>
                  <div className="bg-white/60 border border-[#F3EAF8] p-4 rounded-2xl flex items-center justify-between shadow-sm">
                    
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-[#2D004D]">
                        {getRiskScore(selectedOrder) >= 75 ? "⚠️ Extreme Anomaly Flagged" :
                         getRiskScore(selectedOrder) >= 40 ? "⚡ Moderate Suspicion" :
                         "✓ Secured Account Node"}
                      </span>
                      <span className="text-[8px] text-[#7B3FA0] mt-0.5">
                        {getRiskScore(selectedOrder) >= 75 ? "Calibrated via high disputed region patterns." :
                         getRiskScore(selectedOrder) >= 40 ? "Card coordinates display offset markers." :
                         "Payment authorization matches client IP."}
                      </span>
                    </div>

                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="24" cy="24" r="20" stroke="#f1f1f1" strokeWidth="3" fill="transparent" />
                        <circle 
                          cx="24" 
                          cy="24" 
                          r="20" 
                          stroke={getRiskScore(selectedOrder) >= 75 ? "#FF8597" : getRiskScore(selectedOrder) >= 40 ? "#D8BFE3" : "#B886D0"} 
                          strokeWidth="3.5" 
                          fill="transparent" 
                          strokeDasharray={2 * Math.PI * 20}
                          strokeDashoffset={((100 - getRiskScore(selectedOrder)) / 100) * (2 * Math.PI * 20)}
                          strokeLinecap="round"
                          className="transition-all duration-1000"
                        />
                      </svg>
                      <span className="absolute text-[9px] font-black text-[#2D004D]">{getRiskScore(selectedOrder)}%</span>
                    </div>

                  </div>
                </div>

                {/* Interactive Transaction Event Timeline */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-[9px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Lifecycle Event Timeline</h4>
                  <div className="relative pl-6 flex flex-col gap-6 before:absolute before:left-2.5 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-stone-200/70">
                    
                    {/* Node 1: Created */}
                    <div className="relative flex justify-between items-start">
                      <div className="absolute -left-5 top-1 w-2.5 h-2.5 rounded-full bg-[#B886D0] shadow-[0_0_6px_#B886D0] border-2 border-white" />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[#2D004D]">Client checkout initialization</span>
                        <span className="text-[8px] text-[#7B3FA0] mt-0.5">Authorization request passed to gateway.</span>
                      </div>
                      <span className="text-[8px] font-mono text-[#7B3FA0]">10:00:00</span>
                    </div>

                    {/* Node 2: Paid */}
                    <div className="relative flex justify-between items-start">
                      <div className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 border-white transition-colors duration-500 ${
                        selectedOrder.paymentStatus === "Paid" ? 'bg-[#B886D0] shadow-[0_0_6px_#B886D0]' : 'bg-stone-200'
                      }`} />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[#2D004D]">Invoice verification & receipt</span>
                        <span className="text-[8px] text-[#7B3FA0] mt-0.5">Gateway confirmed payment status.</span>
                      </div>
                      <span className="text-[8px] font-mono text-[#7B3FA0]">10:00:02</span>
                    </div>

                    {/* Node 3: Processing */}
                    <div className="relative flex justify-between items-start">
                      <div className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 border-white transition-colors duration-500 ${
                        selectedOrder.status === "Processing" || selectedOrder.status === "Completed" ? 'bg-[#D8BFE3] shadow-[0_0_6px_#D8BFE3]' : 'bg-stone-200'
                      }`} />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[#2D004D]">Asset serialization pipeline</span>
                        <span className="text-[8px] text-[#7B3FA0] mt-0.5">License key mapped to customer ID.</span>
                      </div>
                      <span className="text-[8px] font-mono text-[#7B3FA0]">10:00:04</span>
                    </div>

                    {/* Node 4: Completed */}
                    <div className="relative flex justify-between items-start">
                      <div className={`absolute -left-5 top-1 w-2.5 h-2.5 rounded-full border-2 border-white transition-colors duration-500 ${
                        selectedOrder.status === "Completed" ? 'bg-[#B886D0] shadow-[0_0_8px_#B886D0]' : 
                        selectedOrder.status === "Refunded" ? 'bg-stone-300' :
                        selectedOrder.status === "Disputed" ? 'bg-[#FF8597] animate-ping' :
                        'bg-stone-200'
                      }`} />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[#2D004D]">
                          {selectedOrder.status === "Refunded" ? "Transaction refunded by creator" :
                           selectedOrder.status === "Disputed" ? "Dispute action initiated by customer" :
                           "Fulfillment and lock release"}
                        </span>
                        <span className="text-[8px] text-[#7B3FA0] mt-0.5">
                          {selectedOrder.status === "Refunded" ? "Fund return map completed." :
                           selectedOrder.status === "Disputed" ? "Awaiting financial institution review." :
                           "All package assets delivered successfully."}
                        </span>
                      </div>
                      <span className="text-[8px] font-mono text-[#7B3FA0]">10:00:05</span>
                    </div>

                  </div>
                </div>

                {/* Invoice Generation Trigger */}
                <div className="flex gap-3 mt-4 border-t border-stone-200/50 pt-5">
                  <button 
                    onClick={() => {
                      sysSound.playTap();
                      setInvoiceOrder(selectedOrder);
                    }}
                    className="flex-1 py-2.5 bg-white hover:bg-[#F5E9DD] border border-stone-200/70 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest text-[#2D004D] transition-colors"
                  >
                    Generate Invoice Receipt
                  </button>
                </div>

              </div>
            ) : (
              <div className="py-20 text-center text-[#7B3FA0]">
                <p className="text-xs">No active ledger entry focused.</p>
                <p className="text-[10px] mt-1">Select an order row from the grid ledger to parse deep metrics.</p>
              </div>
            )}

          </div>

        </section>

      </> )} {/* end !loading && !loadError */}
      </main>

      {/* --- FLOATING COMMAND HUD SYSTEM --- */}
      <div className="fixed bottom-8 right-8 z-40 flex items-center gap-3 bg-white/70 backdrop-blur-xl border border-white/50 p-2.5 rounded-2xl shadow-[0_12px_32px_rgba(90,30,126,0.06)] pointer-events-auto">
        
        {/* Bulk action indicator */}
        {selectedRowIds.length > 0 && (
          <button 
            onClick={() => {
              sysSound.playTap();
              setBulkRefundOpen(true);
            }}
            className="px-4 py-2 bg-[#D8BFE3]/80 hover:bg-[#D8BFE3] border border-[#FF8597]/20 text-[#8c4854] text-[9px] font-extrabold uppercase tracking-wider rounded-xl transition-all"
          >
            Bulk Refund ({selectedRowIds.length})
          </button>
        )}

        <button 
          onClick={handleExportCSV}
          disabled={exporting}
          className="p-3 bg-white hover:bg-[#F5E9DD] text-[#2D004D] rounded-xl transition-colors border border-stone-200/50 flex items-center justify-center"
          title="Export CSV Database"
        >
          {exporting ? (
            <div className="w-4.5 h-4.5 border-2 border-stone-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="Download" size={13} />
          )}
        </button>

        <button 
          onClick={handleTriggerScan}
          disabled={isScanning}
          className={`flex items-center gap-2 px-5 py-2.5 font-extrabold uppercase tracking-widest text-[9px] rounded-xl transition-all duration-300 border ${
            isScanning 
              ? 'bg-[#D8BFE3] text-[#2D004D] border-[#B886D0]' 
              : 'bg-[#2D004D] text-white hover:bg-[#7B3FA0] border-[#2D004D]'
          }`}
          onMouseMove={handleMagneticMove}
          onMouseLeave={handleMagneticLeave}
        >
          <Icon name="RefreshCw" size={10} className={isScanning ? 'animate-spin' : ''} />
          {isScanning ? `Auditing (${scanProgress}%)` : "System Security Scan"}
        </button>

      </div>

      {/* --- MODAL 1: GLASSMORPHIC INVOICE DIALOG --- */}
      <AnimatePresence>
        {invoiceOrder && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 w-full h-full bg-[#2D004D]/30 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden"
            style={{ zIndex: 1000 }}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full border border-stone-200/50 shadow-2xl relative"
            >
              
              {/* Close Button */}
              <button 
                onClick={() => {
                  sysSound.playTap();
                  setInvoiceOrder(null);
                }}
                className="absolute right-6 top-6 p-2 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors border-none cursor-pointer text-[#7B3FA0]"
              >
                <Icon name="X" size={12} />
              </button>

              {/* Invoice Logo */}
              <div className="flex items-center gap-1.5 mb-6 text-editorial font-serif text-lg text-[#2D004D]">
                <span>✧</span> Lumora Invoice
              </div>

              {/* Invoice Core Details */}
              <div className="flex flex-col gap-6 font-sans">
                
                <div className="flex justify-between text-xs">
                  <div className="flex flex-col">
                    <span className="text-[#7B3FA0]">INVOICE TO</span>
                    <span className="font-bold text-[#2D004D] mt-0.5">{invoiceOrder.customerName}</span>
                    <span className="text-[10px] text-stone-400 font-mono mt-0.5">{invoiceOrder.customerEmail}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[#7B3FA0]">INVOICE ID</span>
                    <span className="font-mono font-bold text-[#2D004D] mt-0.5">INV-{invoiceOrder.orderId || invoiceOrder.id}</span>
                    <span className="text-[9px] text-stone-400 mt-0.5">{(invoiceOrder.createdAt || '').split('T')[0]}</span>
                  </div>
                </div>

                <div className="h-px bg-stone-100" />

                {/* Table details */}
                <div className="flex flex-col gap-3">
                  <span className="text-[9px] font-extrabold tracking-widest text-[#7B3FA0] uppercase">Purchased Node</span>
                  
                  <div className="flex justify-between items-center bg-stone-50 p-4 rounded-2xl border border-stone-200/30">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-[#2D004D]">{getProductName(invoiceOrder)}</span>
                      <span className="text-[8px] text-[#7B3FA0] uppercase font-bold tracking-widest mt-0.5">{getProductType(invoiceOrder)}</span>
                    </div>
                    <span className="text-xs font-black text-[#2D004D]">₹{getOrderPrice(invoiceOrder).toFixed(2)}</span>
                  </div>

                </div>

                <div className="h-px bg-stone-100" />

                {/* Calculation */}
                <div className="flex flex-col gap-2.5 text-xs text-[#7B3FA0]">
                  
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-bold text-[#2D004D]">₹{getOrderPrice(invoiceOrder).toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Processing Fee (0%)</span>
                    <span>₹0.00</span>
                  </div>

                  <div className="h-px bg-stone-100/50 my-1" />

                  <div className="flex justify-between text-sm font-serif font-black text-[#2D004D]">
                    <span>Total Paid (INR)</span>
                    <span>₹{getOrderPrice(invoiceOrder).toFixed(2)}</span>
                  </div>

                </div>

                {/* Notice text */}
                <p className="text-[8px] text-[#7B3FA0] text-center mt-4">
                  Thank you for shopping inside the Lumora creator ecosystem. This document confirms direct settlement coordinates for licensing rights.
                </p>

                {/* Action buttons */}
                <div className="flex gap-3.5 mt-2">
                  <button 
                    onClick={() => {
                      sysSound.playTap();
                      triggerNotification("Invoice print instruction sent");
                      setInvoiceOrder(null);
                    }}
                    className="flex-1 py-3 bg-white hover:bg-stone-50 border border-stone-200/70 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest text-[#2D004D] transition-colors"
                  >
                    Print PDF
                  </button>
                  <button 
                    onClick={() => {
                      sysSound.playSuccess();
                      setInvoiceOrder(null);
                    }}
                    className="flex-1 py-3 bg-[#2D004D] hover:bg-[#7B3FA0] rounded-2xl text-[10px] font-extrabold uppercase tracking-widest text-white transition-colors"
                  >
                    Done
                  </button>
                </div>

              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: BULK REFUND WARNING MODAL --- */}
      <AnimatePresence>
        {bulkRefundOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 w-full h-full bg-[#2D004D]/30 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden"
            style={{ zIndex: 1000 }}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full border border-stone-200/50 shadow-2xl relative"
            >
              
              <div className="text-center flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-[#D8BFE3] text-[#FF8597] flex items-center justify-center mb-4">
                  <Icon name="AlertTriangle" size={20} />
                </div>
                <h4 className="text-sm font-serif font-black text-[#2D004D] mb-2">Execute Bulk Return Payout?</h4>
                <p className="text-[10px] text-[#7B3FA0] mb-6 leading-relaxed">
                  You are about to execute return map payouts for <strong>{selectedRowIds.length} select orders</strong>. This will set vendor earnings to ₹0 and disable downloading. This action cannot be undone.
                </p>

                <div className="flex gap-3.5 w-full">
                  <button 
                    onClick={() => {
                      sysSound.playTap();
                      setBulkRefundOpen(false);
                    }}
                    className="flex-1 py-3 bg-white hover:bg-stone-50 border border-stone-200/70 rounded-2xl text-[10px] font-extrabold uppercase tracking-widest text-[#2D004D] transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleBulkRefund}
                    className="flex-1 py-3 bg-[#FF8597] hover:bg-[#ea6377] text-white rounded-2xl text-[10px] font-extrabold uppercase tracking-widest transition-colors"
                  >
                    Refund Payouts
                  </button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </AdminLayout>
  );
}
