import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AdminContextProvider } from './context/AdminContext';
import AdminNotificationBanner from './pages/admin/components/AdminNotificationBanner';


// Helper for dynamic imports that auto-reloads once if a build deployment replaced asset chunk hashes
const safeLazy = (importFn) =>
  lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      const hasReloaded = sessionStorage.getItem('lumora_chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('lumora_chunk_reload', 'true');
        window.location.reload();
        return new Promise(() => {}); // Wait for browser reload
      }
      sessionStorage.removeItem('lumora_chunk_reload');
      throw error;
    }
  });

// ── Lazy page imports ─────────────────────────────────────────────
const AdminLogin = safeLazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = safeLazy(() => import('./pages/admin/Dashboard'));
const AdminAnalytics = safeLazy(() => import('./pages/admin/Analytics'));
const AdminProductsManagement = safeLazy(() => import('./pages/admin/ProductsManagement'));
const AdminOrdersManagement = safeLazy(() => import('./pages/admin/OrdersManagement'));
const AdminPayments = safeLazy(() => import('./pages/admin/Payments'));
const AdminVendors = safeLazy(() => import('./pages/admin/Vendors'));
const AdminCustomersManagement = safeLazy(() => import('./pages/admin/CustomersManagement'));
const AdminReviews = safeLazy(() => import('./pages/admin/Reviews'));
const AdminReports = safeLazy(() => import('./pages/admin/Reports'));
const AdminCampaignManager = safeLazy(() => import('./pages/admin/CampaignManager'));
const PlatformSettings = safeLazy(() => import('./pages/admin/platform/PlatformSettings'));
const AdminSettings = safeLazy(() => import('./pages/admin/Settings'));
const AdminAuditLogs = safeLazy(() => import('./pages/admin/AuditLogs'));
const AdminSupportInbox = safeLazy(() => import('./pages/admin/AdminSupportInbox'));
const AdminUserManagement = safeLazy(() => import('./pages/admin/AdminUserManagement'));
const AcceptInvite = safeLazy(() => import('./pages/admin/AcceptInvite'));
const AdminRegister = safeLazy(() => import('./pages/admin/AdminRegister'));

// ── Error Boundary for SPA chunk loading / render errors ─────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#2D004D', marginBottom: '8px' }}>Version Update Detected</h2>
          <p style={{ color: '#7B3FA0', marginBottom: '20px', maxWidth: '400px', fontSize: '14px' }}>
            A new version of the Admin Panel was deployed. Click below to refresh to the latest release.
          </p>
          <button
            onClick={() => {
              sessionStorage.clear();
              window.location.reload();
            }}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              border: 'none',
              background: '#7B3FA0',
              color: '#fff',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(123,63,160,0.3)',
            }}
          >
            Refresh Admin App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
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
    </ErrorBoundary>
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
