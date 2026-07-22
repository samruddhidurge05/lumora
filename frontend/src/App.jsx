import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './routes/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppContextProvider, useApp } from './context/AppContext';
import { AdminContextProvider } from './context/AdminContext';
import AdminNotificationBanner from './pages/admin/components/AdminNotificationBanner';
import NavigationProgress from './components/NavigationProgress';
import CartDrawer from './components/cart/CartDrawer';

import DownloadReadyPopup from './components/download/DownloadReadyPopup';

/* ── Error boundary ── */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[Lumora] Render error:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#FAF5FF', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ color: '#2D004D', marginBottom: '8px', fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ color: '#7B5FA0', marginBottom: '24px', maxWidth: '500px' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button onClick={() => window.location.reload()}
            style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Lazy page imports ─────────────────────────────────────────────
const Home           = lazy(() => import('./pages/marketplace/Home'));
const Products       = lazy(() => import('./pages/marketplace/Products'));
const ProductPage    = lazy(() => import('./pages/marketplace/ProductPage'));
const CreatorProfile = lazy(() => import('./pages/marketplace/CreatorProfile'));
const Cart           = lazy(() => import('./pages/marketplace/Cart'));
const Checkout       = lazy(() => import('./pages/marketplace/Checkout'));
const Payment        = lazy(() => import('./pages/marketplace/Payment'));
const Success        = lazy(() => import('./pages/marketplace/Success'));
const Wishlist       = lazy(() => import('./pages/marketplace/Wishlist'));
const Search         = lazy(() => import('./pages/marketplace/Search'));
const Categories     = lazy(() => import('./pages/marketplace/Categories'));
const About          = lazy(() => import('./pages/marketplace/About'));
const Contact        = lazy(() => import('./pages/marketplace/Contact'));
const Downloads      = lazy(() => import('./pages/marketplace/Downloads'));
const RefundPolicy   = lazy(() => import('./pages/support/RefundPolicy'));


const LoginSelection    = lazy(() => import('./pages/auth/LoginSelection'));
const RegisterSelection = lazy(() => import('./pages/auth/RegisterSelection'));
const Login             = lazy(() => import('./pages/auth/Login'));
const Register          = lazy(() => import('./pages/auth/Register'));
const ForgotPassword    = lazy(() => import('./pages/auth/ForgotPassword'));
const VerifyEmail       = lazy(() => import('./pages/auth/VerifyEmail'));
const JoinAffiliate     = lazy(() => import('./pages/marketplace/JoinAffiliate'));
const JoinVendor        = lazy(() => import('./pages/marketplace/JoinVendor'));
const ReferralRouteHandler = lazy(() => import('./pages/marketplace/ReferralRouteHandler'));

// Partnerships
const PartnershipHub    = lazy(() => import('./pages/partnerships/PartnershipHub'));
const Affiliate         = lazy(() => import('./pages/partnerships/Affiliate'));
const Vendor            = lazy(() => import('./pages/partnerships/Vendor'));

const CustomerDashboard  = lazy(() => import('./pages/customer/Dashboard'));
const AffiliateDashboard = lazy(() => import('./pages/affiliate/AffiliateDashboard'));

// Vendor pages
const VendorDashboard     = lazy(() => import('./pages/vendor/Dashboard'));
const VendorOrders        = lazy(() => import('./pages/vendor/Orders'));
const VendorProducts      = lazy(() => import('./pages/vendor/ManageProducts'));
const VendorAddProduct    = lazy(() => import('./pages/vendor/AddProduct'));
const VendorEditProduct   = lazy(() => import('./pages/vendor/EditProduct'));
const VendorAnalytics     = lazy(() => import('./pages/vendor/Analytics'));
const VendorEarnings      = lazy(() => import('./pages/vendor/Earnings'));
const VendorWithdrawals   = lazy(() => import('./pages/vendor/Withdrawals'));
const VendorReviews       = lazy(() => import('./pages/vendor/Reviews'));
const VendorAffiliate     = lazy(() => import('./pages/vendor/Affiliate'));
const VendorVerification  = lazy(() => import('./pages/vendor/Verification'));
const VendorStoreSettings = lazy(() => import('./pages/vendor/StoreSettings'));
const VendorProfile       = lazy(() => import('./pages/vendor/Profile'));

const NotFound = lazy(() => import('./pages/error/NotFound'));

// Admin pages
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
const AdminAffiliateManagement = lazy(() => import('./pages/admin/AffiliateManagement'));
const PlatformSettings = lazy(() => import('./pages/admin/platform/PlatformSettings'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const AdminSupportInbox = lazy(() => import('./pages/admin/AdminSupportInbox'));
const AdminUserManagement = lazy(() => import('./pages/admin/AdminUserManagement'));
const AcceptInvite = lazy(() => import('./pages/admin/AcceptInvite'));

// ── Loading spinner ───────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(196,181,253,0.2)', borderTop: '3px solid #7B3FA0', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── SPA Switcher ──────────────────────────────────────────────────
function SPARouter() {
  const { currentView, activeProductId, activeCreatorId } = useApp();
  const renderPage = () => {
    switch (currentView) {
      case 'landing':           return <Home />;
      case 'marketplace':       return <Products />;
      case 'product-detail':    return <ProductPage />;
      case 'creator-profile':   return <CreatorProfile />;
      case 'cart':              return <Cart />;
      case 'checkout':          return <Checkout />;
      case 'payment':           return <Payment />;
      case 'checkout/success':  return <Success />;
      case 'wishlist':          return <Wishlist />;
      case 'search':            return <Search />;
      case 'categories':        return <Categories />;
      case 'about':             return <About />;
      case 'contact':           return <Contact />;
      case 'downloads':         return <Downloads />;
      case 'refund-policy':     return <RefundPolicy />;

      // Legacy in-SPA auth views (navigateTo still works from other components)
      case 'login-selection':    return <LoginSelection />;
      case 'register-selection': return <RegisterSelection />;
      case 'login':              return <Login />;
      case 'register':           return <Register />;
      case 'forgot-password':    return <ForgotPassword />;
      case 'verify-email':       return <VerifyEmail />;
      // In-SPA dashboards
      case 'dashboard':          return <CustomerDashboard />;
      case 'affiliate':          return <AffiliateDashboard />;
      case 'vendor':             return <VendorDashboard />;
      default:                   return <Home />;
    }
  };

  return (
    <>
      <NavigationProgress />
      <CartDrawer />
      <Suspense fallback={<PageLoader />}>
        {renderPage()}
      </Suspense>
    </>
  );
}

function AppContent() {
  const { isAccountDisabled, isPlatformPaused, user, userRole, logout } = useAuth();
  const { navigateTo } = useApp();

  // Download popup state
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [popupData, setPopupData] = useState(null);
  
  const location = useLocation();

  // Synchronize and persist active authentication role across navigation
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(location.search);
      const roleParam = urlParams.get('role');
      let targetRole = null;

      if (roleParam && ['customer', 'affiliate', 'vendor', 'admin'].includes(roleParam)) {
        targetRole = roleParam;
      } else if (location.pathname.startsWith('/affiliate')) {
        targetRole = 'affiliate';
      } else if (location.pathname.startsWith('/vendor')) {
        targetRole = 'vendor';
      } else if (location.pathname.startsWith('/admin')) {
        targetRole = 'admin';
      }

      if (targetRole) {
        if (sessionStorage.getItem('lumora_last_auth_role') !== targetRole) {
          sessionStorage.setItem('lumora_last_auth_role', targetRole);
        }
        if (localStorage.getItem('lumora_active_role') !== targetRole) {
          localStorage.setItem('lumora_active_role', targetRole);
        }
      }
    } catch (_) {}
  }, [location.search, location.pathname]);

  // Listen for purchase completion events
  useEffect(() => {
    const handlePurchaseComplete = (event) => {
      const { orderDetails, purchasedItems } = event.detail;
      setPopupData({ orderDetails, purchasedItems });
      setShowDownloadPopup(true);

      // Refresh user data after purchase
      setTimeout(() => {
        // Trigger a refresh of orders, downloads, and notifications
        window.dispatchEvent(new CustomEvent('lumora_refresh_user_data'));
      }, 2000);
    };

    window.addEventListener('lumora_purchase_complete', handlePurchaseComplete);
    return () => {
      window.removeEventListener('lumora_purchase_complete', handlePurchaseComplete);
    };
  }, []);

  // Central post-authentication referral lifecycle processor
  useEffect(() => {
    if (!user) return;
    try {
      const stored = localStorage.getItem('lumora_pending_referral');
      if (!stored) return;

      const pending = JSON.parse(stored);
      if (!pending || !pending.referral_code) return;

      // Prevent duplicate processing per session
      const processedKey = `lumora_ref_processed_${user.uid}_${pending.product_id}`;
      if (sessionStorage.getItem(processedKey)) return;
      sessionStorage.setItem(processedKey, 'true');

      import('./utils/api').then(({ backendFetch }) => {
        backendFetch('/affiliate/referrals/authenticate', {
          method: 'POST',
          body: JSON.stringify({
            session_id: pending.session_id || sessionStorage.getItem('lumora_ref_session_id'),
            referral_code: pending.referral_code,
            product_id: pending.product_id ? parseInt(pending.product_id, 10) : null
          })
        }).then(() => {
          localStorage.removeItem('lumora_pending_referral');
          if (pending.product_id) {
            // Use SPA navigateTo so AppContext currentView and activeProductId update correctly.
            // window.location.href would bypass the SPA state and show the home page.
            navigateTo('product-detail', pending.product_id);
          }
        }).catch(() => {
          // Attribution failed silently — still open the product so the user isn't stuck
          if (pending.product_id) {
            navigateTo('product-detail', pending.product_id);
          }
        });
      });
    } catch (_) {}
  }, [user?.uid]);


  const handleGoToDownloads = () => {
    setShowDownloadPopup(false);
    setPopupData(null);
    
    // Prevent returning to checkout/payment by pushing a clean state
    window.history.pushState({ page: 'downloads' }, '', '/');
    
    // Navigate to downloads section
    navigateTo('dashboard', 'Downloads');
  };

  const handleClosePopup = () => {
    setShowDownloadPopup(false);
    setPopupData(null);
    
    // Prevent returning to checkout/payment
    window.history.pushState({ page: 'marketplace' }, '', '/');
  };
  
  // Exclude vendor and affiliate roles from the global full-screen blocker
  // since they display the suspension card inside their custom layout (sidebar remains visible).
  const showDisabledBlocker = isAccountDisabled && !['vendor', 'affiliate'].includes(userRole);
  
  // Exclude admin, vendor, and affiliate roles from seeing the platform pause overlay
  // so they can access their dashboard panels and unpause if they are admins.
  const showMaintenance = isPlatformPaused && (userRole === 'customer' || !userRole);

  return (
    <>

      
      {/* Download Ready Popup */}
      {showDownloadPopup && popupData && (
        <DownloadReadyPopup
          isOpen={showDownloadPopup}
          onClose={handleClosePopup}
          onGoToDownloads={handleGoToDownloads}
          purchasedItems={popupData.purchasedItems || []}
          orderDetails={popupData.orderDetails}
        />
      )}
      
      {showDisabledBlocker && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 10, 22, 0.95)',
          backdropFilter: 'blur(20px)',
          color: '#fff',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '40px',
            borderRadius: '24px',
            textAlign: 'center',
            maxWidth: '480px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              color: '#ef4444'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.025em', color: '#fca5a5' }}>Account Suspended</h2>
            <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '32px' }}>
              Your account has been disabled by the platform administrator. If you believe this is an error, please contact support.
            </p>
            <button 
              onClick={logout}
              style={{
                background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                border: 'none',
                color: '#fff',
                padding: '12px 30px',
                fontSize: '0.85rem',
                fontWeight: 700,
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(123, 63, 160, 0.2)'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
      
      {showMaintenance && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 10, 22, 0.95)',
          backdropFilter: 'blur(20px)',
          color: '#fff',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '40px',
            borderRadius: '24px',
            textAlign: 'center',
            maxWidth: '480px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'rgba(123, 63, 160, 0.1)',
              border: '1px solid rgba(123, 63, 160, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              color: '#d8b4fe'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.025em', color: '#e9d5ff' }}>Platform Under Maintenance</h2>
            <p style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '32px' }}>
              Lumora is currently undergoing maintenance. Please try again later.
            </p>
            {user && (
              <button 
                onClick={logout}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  padding: '12px 30px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}

      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ── Auth routes ── */}
          <Route path="/refund-policy"          element={<RefundPolicy />} />
          <Route path="/support/refund-policy"  element={<RefundPolicy />} />
          <Route path="/auth/login-selection"    element={<Navigate to="/auth/login?role=customer" replace />} />

          <Route path="/auth/register-selection" element={<Navigate to="/auth/register?role=customer" replace />} />
          <Route path="/auth/login"              element={<Login />} />
          <Route path="/auth/register"           element={<Register />} />
          <Route path="/auth/forgot-password"    element={<ForgotPassword />} />
          <Route path="/auth/verify-email"       element={<VerifyEmail />} />

          {/* ── Referral routes ── */}
          <Route path="/ref/:code/product/:productId" element={<ReferralRouteHandler />} />
          <Route path="/ref/:code"                    element={<ReferralRouteHandler />} />

          {/* ── Partnership routes ── */}
          <Route path="/partnerships"           element={<PartnershipHub />} />
          <Route path="/partnerships/affiliate" element={<Affiliate />} />
          <Route path="/partnerships/vendor"    element={<Vendor />} />
          <Route path="/partnership/affiliate"  element={<JoinAffiliate />} />
          <Route path="/partnership/vendor"     element={<JoinVendor />} />

          {/* ── Protected dashboard routes ── */}
          <Route path="/vendor" element={<Navigate to="/vendor/dashboard" replace />} />
          <Route path="/affiliate" element={<Navigate to="/affiliate/dashboard" replace />} />
          <Route path="/affiliate/dashboard"
            element={
              <ProtectedRoute redirectTo="/auth/login?role=affiliate" requiredRole={['affiliate', 'vendor']}>
                <AffiliateDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/customer/dashboard"
            element={
              <ProtectedRoute redirectTo="/auth/login?role=customer" requiredRole="customer">
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/vendor/dashboard"
            element={
              <ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor">
                <VendorDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/vendor/orders"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorOrders /></ProtectedRoute>}
          />
          <Route path="/vendor/products"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorProducts /></ProtectedRoute>}
          />
          <Route path="/vendor/add-product"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorAddProduct /></ProtectedRoute>}
          />
          <Route path="/vendor/edit-product/:id"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorEditProduct /></ProtectedRoute>}
          />
          <Route path="/vendor/analytics"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorAnalytics /></ProtectedRoute>}
          />
          <Route path="/vendor/earnings"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorEarnings /></ProtectedRoute>}
          />
          <Route path="/vendor/withdrawals"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorWithdrawals /></ProtectedRoute>}
          />
          <Route path="/vendor/reviews"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorReviews /></ProtectedRoute>}
          />
          <Route path="/vendor/affiliate"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorAffiliate /></ProtectedRoute>}
          />
          <Route path="/vendor/verification"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorVerification /></ProtectedRoute>}
          />
          <Route path="/vendor/store-settings"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorStoreSettings /></ProtectedRoute>}
          />
          <Route path="/vendor/profile"
            element={<ProtectedRoute redirectTo="/auth/login?role=vendor" requiredRole="vendor"><VendorProfile /></ProtectedRoute>}
          />

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
          <Route path="/admin/affiliate-management"
            element={<ProtectedRoute requiredRole="admin"><AdminAffiliateManagement /></ProtectedRoute>}
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

          {/* ── SPA fallback ── */}
          <Route path="*" element={<SPARouter />} />
        </Routes>
      </Suspense>
    </>
  );
}

// ── Root App ──────────────────────────────────────────────────────
// Wraps AdminContext only for admin users — prevents customer/vendor sessions
// from firing /api/admin/* requests that return 403 errors in the console.
function AdminBoundary({ children }) {
  const { userRole, loading } = useAuth();
  const isAdmin = !loading && userRole === 'admin';

  return (
    <>
      {isAdmin && <AdminNotificationBanner />}
      {children}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContextProvider>
          <AdminContextProvider>
            <AdminBoundary>
              <AppContent />
            </AdminBoundary>
          </AdminContextProvider>
        </AppContextProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
