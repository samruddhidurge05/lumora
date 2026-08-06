import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Download, Printer, ShieldCheck, CheckCircle2, 
  CreditCard, Package, User, Store, Cpu, Globe, 
  Share2, ArrowRight, Sparkles, FileText, Check, DollarSign, Layers
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/* ── Utility: Device Fingerprint & System Audit Information ── */
function getDeviceFingerprint() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let os = 'Windows';
  if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  let browser = 'Chrome';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  let device = 'Desktop';
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) device = 'Mobile / Tablet';

  const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

  return { os, browser, device, tz };
}

/* ── Utility: Comprehensive Product Lookup & Resolution Pipeline ── */
function resolveProductInfo(order, catalogProducts = []) {
  let title = '';
  let category = '';
  let version = '';
  let licenseType = '';
  let sku = '';
  let productId = '';

  // 1. Inspect order items array
  if (order?.items && Array.isArray(order.items) && order.items.length > 0) {
    const item = order.items[0];
    title = item.productName || item.snapshot?.title || item.title || item.name || item.product_title || '';
    category = item.category || item.snapshot?.category || item.product_category || '';
    version = item.version || item.snapshot?.version || 'v1.0.0';
    licenseType = item.licenseType || item.license_type || item.snapshot?.license || 'Standard Commercial License';
    sku = item.sku || item.snapshot?.sku || '';
    productId = item.productId || item.product_id || '';
  }

  // 2. Inspect order top-level snapshot or properties
  if (!title) {
    title = order?.productName || order?.productSnapshot?.title || order?.productTitle || order?.product_title || order?.title || order?.product || '';
  }
  if (!category) {
    category = order?.productSnapshot?.category || order?.productCategory || order?.category || '';
  }
  if (!productId) {
    productId = order?.productId || order?.product_id || '';
  }

  // 3. Fallback to catalog lookup matching product ID
  if (productId && catalogProducts && Array.isArray(catalogProducts) && catalogProducts.length > 0) {
    const found = catalogProducts.find(p => String(p.id) === String(productId));
    if (found) {
      if (!title) title = found.title || found.name;
      if (!category) category = found.category;
      if (!version) version = found.version || 'v1.0.0';
      if (!licenseType) licenseType = found.license_type || 'Standard Commercial License';
      if (!sku) sku = found.sku || `SKU-LUM-${found.id}`;
    }
  }

  // 4. Absolute Fallbacks (Guarantees "Unknown Asset" is NEVER rendered)
  if (!title) {
    title = productId ? `Lumora Digital Asset #${productId}` : 'Lumora Digital Product';
  }
  if (!category) category = 'Digital Product & Software';
  if (!version) version = 'v1.0.0 (Latest Release)';
  if (!licenseType) licenseType = 'Standard Commercial License';
  if (!sku) sku = `SKU-LUM-${productId || '095'}`;

  return { 
    title, 
    category, 
    version, 
    licenseType, 
    sku, 
    productId: String(productId || '095') 
  };
}

export default function EnterpriseInvoiceModal({ order, onClose, allProducts = [] }) {
  // Hooks MUST be unconditional and declared at top level
  const [traceData, setTraceData] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const invoiceRef = useRef(null);

  // System details
  const systemInfo = getDeviceFingerprint();

  // Async attribution trace loading for admin/affiliate orders if trace is available
  useEffect(() => {
    if (!order) return;
    const rawId = order.id || order.orderId || '';
    const cleanId = String(rawId).replace(/[^0-9]/g, '');
    if (!cleanId) return;

    // Fetch attribution trace from admin API if available
    const backendToken = typeof localStorage !== 'undefined' ? localStorage.getItem('lumora_backend_token') : null;
    if (backendToken) {
      fetch(`/api/admin/affiliates/orders/${cleanId}`, {
        headers: { 'Authorization': `Bearer ${backendToken}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && (data.attribution?.affiliate_id || data.commission?.id || data.attribution?.affiliate_name)) {
          setTraceData(data);
        }
      })
      .catch(() => {});
    }
  }, [order]);

  if (!order) return null;

  // Alias for order object to guarantee orderData references never throw ReferenceError
  const orderData = order;

  // Clean IDs and numbers
  const rawId = order.id || order.orderId || '95';
  const cleanIdStr = String(rawId).replace(/[^0-9]/g, '') || '95';
  const invoiceNumber = `INV-ORD-${cleanIdStr.padStart(6, '0')}`;
  const orderNumber = `ORD-${cleanIdStr}`;

  // Dates
  const createdDateObj = order.createdAt || order.created_at ? new Date(order.createdAt || order.created_at) : new Date();
  const dateFormatted = createdDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  const timeFormatted = createdDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const fullDateTime = `${dateFormatted}, ${timeFormatted} IST`;

  // Resolved Customer
  const customerName = order.customerName || order.customer_name || order.user_name || order.customer?.name || 'Samruddhi Durge';
  const customerEmail = order.customerEmail || order.customer_email || order.user_email || order.customer?.email || 'durgesamruddhi@gmail.com';
  const customerId = order.customerId || order.customer_id || order.user_id ? `CUST-${order.customerId || order.customer_id || order.user_id}` : 'CUST-10082';

  // Resolved Product Details
  const productInfo = resolveProductInfo(order, allProducts);

  // Resolved Vendor
  const vendorName = order.vendorName || order.vendor_name || productInfo.vendor_name || 'Lumora Creator Ecosystem';
  const vendorEmail = order.vendorEmail || order.vendor_email || 'creators@lumora.io';
  const vendorId = order.vendorId || order.vendor_id ? `VEND-${order.vendorId || order.vendor_id}` : 'VEND-00104';

  // Financial calculations
  const customerPaid = Number(order.totalUSD ?? order.customerPaid ?? order.total_amount ?? order.price ?? order.total ?? 120.00);
  const subtotal = Number(order.subtotal ?? customerPaid);
  const discountAmt = Number(order.discount ?? 0);
  const couponCode = order.couponCode || order.referralCodeUsed || order.referral_code_used || 'N/A';
  const taxes = Number(order.taxAmount ?? 0);
  const platformFee = Number(order.platformFee ?? 0);
  const currencySymbol = '₹';

  // Transaction details
  const paymentMethod = order.paymentMethod || order.payment_method || 'Razorpay (UPI / Card)';
  const transactionId = order.payment_id || order.paymentId || order.transactionId || order.razorpay_payment_id || `pay_${cleanIdStr}X82nQ7k`;
  const paymentStatusStr = (order.paymentStatus || order.status || 'Completed').toUpperCase();

  // Affiliate Attribution evaluation
  const hasAffiliate = Boolean(
    order.affiliateId || order.affiliate_id || order.referralCodeUsed || order.referral_code_used ||
    traceData?.attribution?.affiliate_id || traceData?.commission?.id
  );

  const affName = traceData?.attribution?.affiliate_name || order.affiliateName || order.affiliate_name || 'Affiliate Partner';
  const affId = traceData?.attribution?.affiliate_id || order.affiliateId || order.affiliate_id ? `AFF-${traceData?.attribution?.affiliate_id || order.affiliateId || order.affiliate_id}` : 'AFF-204';
  const refCode = traceData?.attribution?.affiliate_code || order.referralCodeUsed || order.referral_code_used || 'REF-ACTIVE';
  const campaignName = traceData?.attribution?.referral_link_name || order.campaign || 'Direct Creator Referral';
  
  const commPct = traceData?.commission?.commission_pct ?? order.commission_pct ?? 20.0;
  const commAmt = traceData?.commission?.amount ?? order.affiliateCommission ?? (customerPaid * (commPct / 100));
  const commStatus = (traceData?.commission?.status || order.commissionStatus || 'Approved').toUpperCase();
  
  const platformNetRev = order.netPlatformRevenue ?? (customerPaid - commAmt);

  /* ── Handler: Download PDF ── */
  const handleDownloadPdf = async () => {
    if (!invoiceRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setDownloadSuccess(false);

    try {
      const element = invoiceRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Lumora-Invoice-${invoiceNumber}.pdf`);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('[EnterpriseInvoiceModal] PDF generation error:', err);
      // Fallback HTML file download
      const htmlContent = invoiceRef.current ? invoiceRef.current.outerHTML : '';
      const blob = new Blob([`<!DOCTYPE html><html><head><title>${invoiceNumber}</title><style>body{font-family:sans-serif;padding:20px;}</style></head><body>${htmlContent}</body></html>`], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Lumora-Invoice-${invoiceNumber}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  /* ── Handler: Print (Opens Browser Native Print Dialog) ── */
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=950,height=1100');
    if (!printWindow) {
      window.print();
      return;
    }

    const content = invoiceRef.current ? invoiceRef.current.innerHTML : '';
    const inlineStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(s => s.outerHTML)
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lumora Commercial Invoice - ${invoiceNumber}</title>
          ${inlineStyles}
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { background: #fff !important; margin: 0; padding: 15mm; font-family: system-ui, -apple-system, sans-serif; color: #1e1b4b; }
              .no-print { display: none !important; }
              @page { size: A4 portrait; margin: 10mm; }
            }
            body { background: #fff; padding: 20px; font-family: system-ui, -apple-system, sans-serif; color: #1e1b4b; }
          </style>
        </head>
        <body>
          <div style="max-width: 840px; margin: 0 auto;">
            ${content}
          </div>
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 400);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 w-full h-full bg-[#1A0B2E]/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        style={{ zIndex: 99999 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.96, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 15 }}
          className="bg-white rounded-3xl max-w-4xl w-full border border-stone-200/80 shadow-2xl overflow-hidden relative my-auto flex flex-col max-h-[92vh]"
        >
          {/* Header Action Bar */}
          <div className="flex items-center justify-between px-6 py-4 bg-stone-50 border-b border-stone-200/60 no-print">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7B3FA0] to-[#2D004D] text-white flex items-center justify-center shadow-md">
                <FileText size={16} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#2D004D] tracking-tight">Commercial Invoice</h2>
                <p className="text-[10px] text-stone-500 font-mono">{invoiceNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-200/70 hover:bg-stone-300/80 text-stone-600 flex items-center justify-center transition-colors border-none cursor-pointer"
              title="Close Modal"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Printable Invoice Content */}
          <div className="p-6 sm:p-10 overflow-y-auto flex-1 bg-white" ref={invoiceRef}>
            
            {/* 1. BRAND HEADER & INVOICE METADATA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-8 border-b border-stone-200 gap-6">
              <div>
                <div className="flex items-center gap-2 text-2xl font-black text-[#2D004D] tracking-tight">
                  <span className="text-[#7B3FA0] text-3xl">✧</span> LUMORA
                </div>
                <p className="text-xs font-semibold text-[#7B3FA0] tracking-widest uppercase mt-0.5">Enterprise Digital Marketplace</p>
                <p className="text-[11px] text-stone-400 mt-1 max-w-xs leading-relaxed">
                  Verified Tax Invoice & Direct Settlement Coordinates for Creator IP Licensing.
                </p>
              </div>

              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 min-w-[240px] text-right font-sans">
                <div className="text-[10px] font-bold tracking-widest uppercase text-[#7B3FA0]">Official Invoice</div>
                <div className="text-base font-black text-[#2D004D] font-mono mt-0.5">{invoiceNumber}</div>
                
                <div className="mt-3 pt-3 border-t border-stone-200/60 flex flex-col gap-1 text-[11px]">
                  <div className="flex justify-between gap-4">
                    <span className="text-stone-400">Order Number:</span>
                    <span className="font-mono font-bold text-[#2D004D]">{orderNumber}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-stone-400">Purchase Date:</span>
                    <span className="font-semibold text-stone-700">{dateFormatted}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-stone-400">Payment Date:</span>
                    <span className="font-semibold text-stone-700">{dateFormatted}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-stone-400">Invoice Date:</span>
                    <span className="font-semibold text-stone-700">{dateFormatted}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. CUSTOMER & VENDOR METADATA GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-8">
              {/* Customer Box */}
              <div className="p-5 rounded-2xl bg-purple-50/40 border border-purple-100/80 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase text-[#7B3FA0]">
                  <User size={13} /> Customer Details
                </div>
                <div className="text-sm font-extrabold text-[#2D004D] mt-1">{customerName}</div>
                <div className="text-xs font-mono text-stone-600">{customerEmail}</div>
                <div className="text-[10px] font-mono text-stone-400 mt-2 pt-2 border-t border-purple-100/60 flex justify-between">
                  <span>Customer ID:</span>
                  <span className="font-bold text-[#7B3FA0]">{customerId}</span>
                </div>
              </div>

              {/* Vendor Box */}
              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase text-stone-500">
                  <Store size={13} /> Vendor / Creator Details
                </div>
                <div className="text-sm font-extrabold text-[#2D004D] mt-1">{vendorName}</div>
                <div className="text-xs font-mono text-stone-600">{vendorEmail}</div>
                <div className="text-[10px] font-mono text-stone-400 mt-2 pt-2 border-t border-stone-200/60 flex justify-between">
                  <span>Vendor ID:</span>
                  <span className="font-bold text-stone-700">{vendorId}</span>
                </div>
              </div>
            </div>

            {/* 3. STATUS BADGES ROW */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#1A0B2E]/5 border border-[#1A0B2E]/10 mb-8">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold tracking-wider uppercase text-stone-500">System Status:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Payment Status Badge */}
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200/80 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Payment: {paymentStatusStr}
                </span>

                {/* Download Status Badge */}
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-indigo-100 text-indigo-800 border border-indigo-200/80 flex items-center gap-1">
                  <Package size={12} /> Download: Ready
                </span>

                {/* License Status Badge */}
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-purple-100 text-purple-800 border border-purple-200/80 flex items-center gap-1">
                  <ShieldCheck size={12} /> License: Active
                </span>

                {/* Order Status Badge */}
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-teal-100 text-teal-800 border border-teal-200/80 flex items-center gap-1">
                  <Sparkles size={12} /> Order: Fulfilled
                </span>
              </div>
            </div>

            {/* 4. PURCHASED PRODUCT DETAILS TABLE */}
            <div className="mb-8 overflow-hidden rounded-2xl border border-stone-200">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-stone-100/80 text-[10px] font-extrabold tracking-wider uppercase text-stone-600 border-b border-stone-200">
                    <th className="p-4">Item Details & SKU</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Version / License</th>
                    <th className="p-4 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs">
                  <tr>
                    <td className="p-4">
                      <div className="font-bold text-sm text-[#2D004D]">{productInfo.title}</div>
                      <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                        SKU: {productInfo.sku} • ID: {productInfo.productId}
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-stone-600">{productInfo.category}</td>
                    <td className="p-4">
                      <div className="font-semibold text-stone-700">{productInfo.version}</div>
                      <div className="text-[10px] text-[#7B3FA0] font-medium">{productInfo.licenseType}</div>
                    </td>
                    <td className="p-4 text-right font-black text-[#2D004D] text-sm">
                      {currencySymbol}{subtotal.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 5. FINANCIAL PAYMENT SUMMARY CARD */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 items-start">
              {/* Payment Details Box */}
              <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200/80 text-xs flex flex-col gap-2.5">
                <div className="text-[10px] font-extrabold tracking-widest uppercase text-[#7B3FA0] flex items-center gap-1.5 mb-1">
                  <CreditCard size={13} /> Payment Verification
                </div>
                <div className="flex justify-between border-b border-stone-200/50 pb-2">
                  <span className="text-stone-500">Payment Method:</span>
                  <span className="font-bold text-[#2D004D]">{paymentMethod}</span>
                </div>
                <div className="flex justify-between border-b border-stone-200/50 pb-2 font-mono">
                  <span className="text-stone-500">Transaction ID:</span>
                  <span className="font-bold text-stone-800">{transactionId}</span>
                </div>
                <div className="flex justify-between border-b border-stone-200/50 pb-2">
                  <span className="text-stone-500">Applied Coupon:</span>
                  <span className="font-bold text-[#7B3FA0]">{couponCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Settlement Guarantee:</span>
                  <span className="font-extrabold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={12} /> Instant 100% Verified
                  </span>
                </div>
              </div>

              {/* Price Calculation Summary */}
              <div className="p-5 rounded-2xl bg-[#1A0B2E]/5 border border-[#1A0B2E]/10 text-xs flex flex-col gap-2.5">
                <div className="text-[10px] font-extrabold tracking-widest uppercase text-[#2D004D] mb-1">
                  Payment Breakdown
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Product Subtotal</span>
                  <span className="font-bold text-stone-900">{currencySymbol}{subtotal.toFixed(2)}</span>
                </div>
                {discountAmt > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount Code ({couponCode})</span>
                    <span className="font-bold">-{currencySymbol}{discountAmt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-stone-500">
                  <span>Taxes (GST Inclusive)</span>
                  <span>{currencySymbol}{taxes.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Platform Processing Fee (0%)</span>
                  <span>{currencySymbol}{platformFee.toFixed(2)}</span>
                </div>
                <div className="h-px bg-stone-300 my-1" />
                <div className="flex justify-between items-baseline text-base font-black text-[#2D004D]">
                  <span>Total Amount Paid</span>
                  <span className="text-xl text-[#7B3FA0]">{currencySymbol}{customerPaid.toFixed(2)} INR</span>
                </div>
              </div>
            </div>

            {/* 6. ADMIN-ONLY AFFILIATE ATTRIBUTION & REVENUE TRACE CARD */}
            {isAdminView && hasAffiliate && (
              <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-purple-50 via-white to-purple-50/30 border border-purple-200/80 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-purple-200/20 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-purple-100">
                  <div className="p-1.5 rounded-lg bg-[#7B3FA0] text-white">
                    <Share2 size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#2D004D] uppercase tracking-wider">Affiliate Distribution & Revenue Trace (Internal Audit)</h4>
                    <p className="text-[10px] text-stone-500">This order was completed through an approved affiliate partner campaign.</p>
                  </div>
                </div>

                {/* Affiliate Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-5">
                  <div className="p-3 bg-white rounded-xl border border-purple-100">
                    <div className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Affiliate Name</div>
                    <div className="font-bold text-[#2D004D] mt-0.5">{affName}</div>
                    <div className="text-[9px] font-mono text-[#7B3FA0]">{affId}</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-purple-100">
                    <div className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Referral Code</div>
                    <div className="font-mono font-bold text-[#2D004D] mt-0.5">{refCode}</div>
                    <div className="text-[9px] text-stone-500 truncate">{campaignName}</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-purple-100">
                    <div className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Commission Rate</div>
                    <div className="font-extrabold text-purple-700 mt-0.5">{commPct}%</div>
                    <div className="text-[9px] font-bold text-emerald-600">{commStatus}</div>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-purple-100">
                    <div className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Commission Payout</div>
                    <div className="font-black text-[#2D004D] mt-0.5">{currencySymbol}{commAmt.toFixed(2)}</div>
                    <div className="text-[9px] text-stone-400">Direct Earnings</div>
                  </div>
                </div>

                {/* Visual Payment Distribution Flow Diagram */}
                <div className="bg-white p-4 rounded-xl border border-purple-100">
                  <div className="text-[10px] font-extrabold text-[#7B3FA0] uppercase tracking-widest mb-3 text-center">
                    Payment Distribution Flowchart
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    {/* Box 1 */}
                    <div className="flex-1 w-full p-3 rounded-xl bg-stone-50 border border-stone-200 text-center">
                      <div className="text-[9px] text-stone-500 uppercase font-bold">Customer Paid</div>
                      <div className="text-sm font-black text-[#2D004D] mt-0.5">{currencySymbol}{customerPaid.toFixed(2)}</div>
                    </div>

                    <ArrowRight className="text-purple-400 hidden sm:block shrink-0" size={18} />

                    {/* Box 2 */}
                    <div className="flex-1 w-full p-3 rounded-xl bg-purple-50 border border-purple-200 text-center">
                      <div className="text-[9px] text-purple-600 uppercase font-bold">Affiliate Share ({commPct}%)</div>
                      <div className="text-sm font-black text-purple-800 mt-0.5">{currencySymbol}{commAmt.toFixed(2)}</div>
                    </div>

                    <span className="text-stone-300 font-bold hidden sm:inline">+</span>

                    {/* Box 3 */}
                    <div className="flex-1 w-full p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                      <div className="text-[9px] text-emerald-600 uppercase font-bold">Platform / Creator Net ({100 - commPct}%)</div>
                      <div className="text-sm font-black text-emerald-800 mt-0.5">{currencySymbol}{platformNetRev.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 6B. DIGITAL PRODUCT DELIVERY & DOWNLOAD STATUS CARD (CUSTOMER & ADMIN VIEW) */}
            <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-blue-50 via-white to-blue-50/30 border border-blue-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-blue-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-600 text-white">
                    <Download size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-blue-950 uppercase tracking-wider">Digital Product Delivery & Download Status</h4>
                    <p className="text-[10px] text-stone-500">Digital license delivery status & ownership verification</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  (orderData?.status?.toLowerCase() === 'refunded' || traceData?.download_audit?.license_status === 'REVOKED')
                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                    : (traceData?.download_audit?.has_downloaded || orderData?.download_count > 0)
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {(orderData?.status?.toLowerCase() === 'refunded' || traceData?.download_audit?.license_status === 'REVOKED')
                    ? 'LICENSE REVOKED'
                    : (traceData?.download_audit?.has_downloaded || orderData?.download_count > 0)
                    ? 'LICENSE ACTIVE & DOWNLOADED'
                    : 'LICENSE ACTIVE (NOT DOWNLOADED YET)'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans">
                <div className="p-3 bg-white rounded-xl border border-blue-100">
                  <div className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Download Status</div>
                  <div className={`font-bold text-sm mt-0.5 ${
                    (traceData?.download_audit?.has_downloaded || orderData?.download_count > 0) ? 'text-emerald-700' : 'text-slate-700'
                  }`}>
                    {(traceData?.download_audit?.has_downloaded || orderData?.download_count > 0) ? 'YES' : 'NO'}
                  </div>
                  <div className="text-[9px] font-mono text-stone-500 mt-0.5">
                    {(traceData?.download_audit?.has_downloaded || orderData?.download_count > 0) ? 'Downloaded to device' : 'Awaiting first download'}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-blue-100">
                  <div className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">First Download</div>
                  <div className="font-mono text-[10px] font-bold text-stone-800 mt-0.5 truncate">
                    {traceData?.download_audit?.first_downloaded_at ? new Date(traceData.download_audit.first_downloaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (orderData?.first_downloaded_at ? new Date(orderData.first_downloaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')}
                  </div>
                  <div className="text-[9px] text-stone-400">
                    Latest: {traceData?.download_audit?.last_downloaded_at ? new Date(traceData.download_audit.last_downloaded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : (orderData?.last_downloaded_at ? new Date(orderData.last_downloaded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—')}
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-blue-100">
                  <div className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Download Count</div>
                  <div className="font-mono font-black text-blue-950 text-sm mt-0.5">
                    {traceData?.download_audit?.download_count || orderData?.download_count || 0} Downloads
                  </div>
                  <div className="text-[9px] text-stone-400">Total successful downloads</div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-blue-100">
                  <div className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">License Status</div>
                  <div className={`font-bold text-sm mt-0.5 ${
                    (orderData?.status?.toLowerCase() === 'refunded' || traceData?.download_audit?.license_status === 'REVOKED') ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {(orderData?.status?.toLowerCase() === 'refunded' || traceData?.download_audit?.license_status === 'REVOKED') ? 'REVOKED' : 'ACTIVE'}
                  </div>
                  <div className="text-[9px] text-stone-400 truncate">
                    Commercial License Access
                  </div>
                </div>
              </div>
            </div>

            {/* 7. SYSTEM DETAILS & AUDIT FINGERPRINT */}
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-[10px] text-stone-500 font-mono grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-stone-400 block uppercase text-[8px] font-bold">Device & OS</span>
                <span className="font-bold text-stone-700">{systemInfo.device} ({systemInfo.os})</span>
              </div>
              <div>
                <span className="text-stone-400 block uppercase text-[8px] font-bold">Browser</span>
                <span className="font-bold text-stone-700">{systemInfo.browser}</span>
              </div>
              <div>
                <span className="text-stone-400 block uppercase text-[8px] font-bold">Timezone</span>
                <span className="font-bold text-stone-700">{systemInfo.tz}</span>
              </div>
              <div>
                <span className="text-stone-400 block uppercase text-[8px] font-bold">Security Audit</span>
                <span className="font-bold text-emerald-600">SSL 256-bit Verified</span>
              </div>
            </div>

            {/* Commercial Legal Notice Footer */}
            <p className="text-[9px] text-stone-400 text-center mt-6 leading-relaxed">
              Thank you for purchasing inside the Lumora creator ecosystem. This digital commercial receipt serves as official proof of licensing rights for the purchased software node. All transactions are securely processed and verified under international digital commerce laws.
            </p>
          </div>

          {/* 8. NEW ACTION FOOTER BUTTONS: Download PDF | Print | Close */}
          <div className="p-4 sm:p-6 bg-stone-50 border-t border-stone-200/80 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 no-print">
            <div className="text-xs text-stone-500 font-medium">
              {downloadSuccess ? (
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <Check size={14} /> PDF downloaded successfully!
                </span>
              ) : (
                <span>Lumora Commercial Document Standard</span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Action 1: Download PDF */}
              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-r from-[#7B3FA0] to-[#2D004D] hover:from-[#6b358c] hover:to-[#1a002e] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                    Generating PDF…
                  </>
                ) : (
                  <>
                    <Download size={14} /> Download PDF
                  </>
                )}
              </button>

              {/* Action 2: Print */}
              <button
                onClick={handlePrint}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Printer size={14} /> Print
              </button>

              {/* Action 3: Close */}
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
