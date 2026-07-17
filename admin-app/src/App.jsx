import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminContextProvider } from './context/AdminContext';
import AdminNotificationBanner from './pages/admin/components/AdminNotificationBanner';


// ── Lazy page imports ─────────────────────────────────────────────
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminAnalytics = lazy(() => import('./pages/admin/Analytics'));
const AdminProductsManagement = lazy(() => import('./pages/admin/ProductsManagement'));
const AdminOrdersManagement = lazy(() => import('./pages/admin/OrdersManagement'));
const AdminPayments = lazy(() => import('./pages/admin/Payments'));
const AdminVendors = lazy(() => import('./pages/admin/Vendors'));
const AdminCustomersManagement = lazy(() => import('./pages/admin/CustomersManagement'));
const AdminReviews = lazy(() => import('./pages/admin/Reviews'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AdminCampaignManager = lazy(() => import('./pages/admin/CampaignManager'));
const PlatformSettings = lazy(() => import('./pages/admin/platform/PlatformSettings'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const AdminSupportInbox = lazy(() => import('./pages/admin/AdminSupportInbox'));
const AdminUserManagement = lazy(() => import('./pages/admin/AdminUserManagement'));
const AcceptInvite = lazy(() => import('./pages/admin/AcceptInvite'));
const AdminRegister = lazy(() => import('./pages/admin/AdminRegister'));

// ── Loading spinner ───────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(196,181,253,0.2)', borderTop: '3px solid #7B3FA0', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AppContent() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── Admin routes ── */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard"
          element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>}
        />
        <Route path="/admin/analytics"
          element={<ProtectedRoute requiredRole="admin"><AdminAnalytics /></ProtectedRoute>}
        />
        <Route path="/admin/products"
          element={<ProtectedRoute requiredRole="admin"><AdminProductsManagement /></ProtectedRoute>}
        />
        <Route path="/admin/orders"
          element={<ProtectedRoute requiredRole="admin"><AdminOrdersManagement /></ProtectedRoute>}
        />
        <Route path="/admin/payments"
          element={<ProtectedRoute requiredRole="admin"><AdminPayments /></ProtectedRoute>}
        />
        <Route path="/admin/vendors"
          element={<ProtectedRoute requiredRole="admin"><AdminVendors /></ProtectedRoute>}
        />
        <Route path="/admin/customers"
          element={<ProtectedRoute requiredRole="admin"><AdminCustomersManagement /></ProtectedRoute>}
        />
        <Route path="/admin/reviews"
          element={<ProtectedRoute requiredRole="admin"><AdminReviews /></ProtectedRoute>}
        />
        <Route path="/admin/reports"
          element={<ProtectedRoute requiredRole="admin"><AdminReports /></ProtectedRoute>}
        />
        <Route path="/admin/campaign-manager"
          element={<ProtectedRoute requiredRole="admin"><AdminCampaignManager /></ProtectedRoute>}
        />
        <Route path="/admin/platform"
          element={<ProtectedRoute requiredRole="admin"><PlatformSettings /></ProtectedRoute>}
        />
        <Route path="/admin/settings"
          element={<ProtectedRoute requiredRole="admin"><AdminSettings /></ProtectedRoute>}
        />
        <Route path="/admin/audit-logs"
          element={<ProtectedRoute requiredRole="admin"><AdminAuditLogs /></ProtectedRoute>}
        />
        <Route path="/admin/support"
          element={<ProtectedRoute requiredRole="admin"><AdminSupportInbox /></ProtectedRoute>}
        />
        <Route path="/admin/team"
          element={<ProtectedRoute requiredRole="admin"><AdminUserManagement /></ProtectedRoute>}
        />
        <Route path="/admin/accept-invite"
          element={<AcceptInvite />}
        />
        <Route path="/admin/register"
          element={<AdminRegister />}
        />

        {/* ── Admin app fallbacks ── */}
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

function AdminBoundary({ children }) {
  const { userRole, loading } = useAuth();
  const isAdmin = userRole === 'admin';

  if (loading || !isAdmin) {
    return <>{children}</>;
  }

  return (
    <AdminContextProvider>
      <AdminNotificationBanner />
      {children}
    </AdminContextProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AdminBoundary>

        <AppContent />
      </AdminBoundary>
    </AuthProvider>
  );
}
