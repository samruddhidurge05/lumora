/* src/context/AuthContext.jsx */
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, db } from '../services/firebase';
import { syncWithBackend, clearBackendToken } from '../services/authService';
import { adminLogin, adminRefreshToken } from '../services/adminAuthService';
import { backendFetch, registerGlobalErrorListener } from '../utils/api';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as firebaseUpdateProfile,
  sendEmailVerification,
  onAuthStateChanged,
  reload,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  increment,
  onSnapshot,
} from 'firebase/firestore';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

/** Helper to log auth events to Firestore (best-effort, non-blocking) */
const logAuthEvent = async (uid, email, eventType, success, failureReason = null) => {
  // Best-effort only — never block the auth flow on a logging failure.
  // Silently swallow errors (quota exhausted, rules, offline) to avoid console noise.
  try {
    const logRef = doc(db, 'auth_logs', `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
    await setDoc(logRef, {
      uid,
      email,
      provider: eventType.includes('google') ? 'google'
              : eventType.includes('github') ? 'github'
              : eventType.includes('twitter') ? 'twitter'
              : 'password',
      eventType,
      timestamp: serverTimestamp(),
      ipAddress: null, // client cannot reliably obtain IP
      userAgent: navigator.userAgent,
      success,
      failureReason,
    });
  } catch (_) {
    // Intentionally silent — auth log failure must never surface to the user
    // or pollute the production console (quota exceeded, offline, rules denied).
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [userRole, setUserRole] = useState(null);   // 'customer' | 'affiliate' | 'vendor'
  const [loading, setLoading] = useState(true);
  const [isAccountDisabled, setIsAccountDisabled] = useState(false);
  const [isPlatformPaused, setIsPlatformPaused] = useState(false);

  useEffect(() => {
    registerGlobalErrorListener((err) => {
      if (err.code === 'ACCOUNT_DISABLED') {
        setIsAccountDisabled(true);
      } else if (err.code === 'PLATFORM_PAUSED') {
        setIsPlatformPaused(true);
      }
    });

    const settingsDocRef = doc(db, 'platformSettings', 'global');
    const unsubSettings = onSnapshot(settingsDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setIsPlatformPaused(!!data.isPlatformPaused);
      } else {
        setIsPlatformPaused(false);
      }
    }, (err) => {
      console.warn('[AuthContext] Global settings listener failed:', err.message);
    });

    return () => {
      unsubSettings();
    };
  }, []);

  // Ref guard: prevent the /auth/me status check from re-running after it
  // updates userRole (which would trigger this same effect again → loop).
  const statusCheckDoneRef = useRef(false);

  // ── One-time /auth/me check per session ───────────────────────────────────
  // Runs once when user is set. Checks is_active and syncs role from backend.
  // Separated from the Firestore listener so it doesn't restart on role changes.
  useEffect(() => {
    if (!user) {
      setIsAccountDisabled(false);
      statusCheckDoneRef.current = false; // reset for next login
      return;
    }

    // One-time check: only runs once per user session, and only when token exists
    if (!statusCheckDoneRef.current && localStorage.getItem('lumora_backend_token')) {
      statusCheckDoneRef.current = true;
      backendFetch('/auth/me')
        .then(session => {
          if (session) {
            if (!session.is_active) {
              setIsAccountDisabled(true);
            }
            // Keep role in sync with backend SOT (only update if it actually changed)
            if (session.role && session.role !== 'user') {
              const backendRole = session.role;
              setUserRole(prev => {
                if (backendRole !== prev) {
                  localStorage.setItem('lumora_active_role', backendRole);
                  return backendRole;
                }
                return prev;
              });
            }
          }
        })
        .catch((err) => {
          console.warn('[AuthContext-MountSync] /auth/me fetch failed:', err.message);
        });
    }
  }, [user]); // ← depends only on user, not userRole

  // ── Firestore real-time user status listener ───────────────────────────────
  // Separate effect so it never restarts due to userRole changes.
  // The listener fires instantly when the admin disables the account in Firestore.
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const statusVal = (data.accountStatus || data.status || 'active').toLowerCase();
        setIsAccountDisabled(statusVal !== 'active');
      } else {
        setIsAccountDisabled(false);
      }
    }, (err) => {
      console.warn('[AuthContext] Real-time user listener failed:', err.message);
    });

    return () => {
      unsubUser();
    };
  }, [user]); // ← depends only on user — never restarts due to role changes

  // Helper to change role manually
  const updateRole = (newRole) => {
    const norm = newRole === 'user' ? 'customer' : newRole;
    setUserRole(norm);
    localStorage.setItem('lumora_active_role', norm);
  };

  // ── Backend session polling ─────────────────────────────────────────────────
  // Poll /auth/me every 10 s while a non-admin user is logged in.
  // Uses a ref for userRole so the interval is NOT restarted when role changes.
  // This ensures account suspension and platform pause are detected within ~10 s.
  const userRoleRef = useRef(userRole);
  useEffect(() => {
    userRoleRef.current = userRole;
  }, [userRole]);

  const logoutRef = useRef(null);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  useEffect(() => {
    if (!user) return;

    const poll = async () => {
      // Skip poll if no backend token exists — avoids 401 spam on login page
      if (!localStorage.getItem('lumora_backend_token')) return;
      try {
        const session = await backendFetch('/auth/me');
        if (!session) return;
        // Update suspension state
        setIsAccountDisabled(!session.is_active);
        // Update platform pause state
        if (session.platform_paused !== undefined) {
          setIsPlatformPaused(!!session.platform_paused);
        }
        // Keep role in sync — read current role via ref to avoid stale closure
        if (session.role) {
          const normalized = session.role === 'user' ? 'customer' : session.role;
          if (normalized !== userRoleRef.current) {
            setUserRole(normalized);
            localStorage.setItem('lumora_active_role', normalized);
          }
        }
      } catch (err) {
        // Non-fatal — backend may be temporarily unreachable
        if (err?.status === 401) {
          logoutRef.current();
        }
      }
    };

    const intervalId = setInterval(poll, 10000); // every 10 s
    return () => clearInterval(intervalId);
  }, [user]); // ← depends only on user — interval never restarts on role change

  // ── Proactive admin JWT refresh ────────────────────────────────────────────
  // Runs every 60 s for admin sessions. Refreshes the backend JWT when it has
  // less than 30 minutes remaining. On failure, signs out and redirects to
  // /admin/login so the admin can re-authenticate cleanly.
  useEffect(() => {
    if (!user || userRole !== 'admin') return;

    const refreshInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem('lumora_backend_token');
        if (!token) return;
        let exp = 0;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          exp = (payload.exp || 0) * 1000; // convert to ms
        } catch (_) {
          // Malformed token — treat as expired
          exp = 0;
        }
        const thirtyMinutesMs = 30 * 60 * 1000;
        if (exp - Date.now() < thirtyMinutesMs) {
          await adminRefreshToken(user);
        }
      } catch (refreshErr) {
        console.warn('[AuthContext] Admin JWT refresh failed:', refreshErr.message);
        await signOut(auth);
        clearBackendToken();
        window.location.href = '/admin/login';
      }
    }, 60000); // every 60 s

    return () => clearInterval(refreshInterval);
  }, [user, userRole]);

  // Observe auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // ── Admin branch: check for existing admin token ─────────────────────
        // Admin uses a separate JWT flow (Firebase ID token, not firebase-sync).
        // We detect this by the 'admin' hint in localStorage which is set
        // BEFORE signInWithPopup is called in AdminLogin.jsx to win the race.
        const localHint = localStorage.getItem('lumora_active_role') || 'customer';

        if (localHint === 'admin') {
          // If we already have a valid backend token, skip re-calling adminLogin.
          // AdminLogin.jsx calls adminLogin() directly in the popup handler —
          // that call sets lumora_backend_token before onAuthStateChanged runs.
          const existingToken = localStorage.getItem('lumora_backend_token');
          if (!existingToken) {
            // No token yet — this is a page-reload admin session restore.
            // Re-exchange the Firebase token for a fresh backend JWT.
            try {
              await adminLogin(firebaseUser);
            } catch (adminErr) {
              console.warn('[AuthContext] Admin session restore failed:', adminErr.message);
              clearBackendToken();
              await signOut(auth);
              window.location.replace('/admin/login');
              return;
            }
          }
          // Token is present (either just set by popup handler or restored from storage).
          setUserRole('admin');
          localStorage.setItem('lumora_active_role', 'admin');
          setLoading(false);
          return; // do NOT call syncWithBackend for admin
        }

        // ── STEP 2: syncWithBackend — backend is the authoritative role SOT ─
        // Pass localHint to backend so it knows our desired active role session.
        let backendRole = null;
        let backendIsActive = true;
        try {
          const syncResult = await syncWithBackend(firebaseUser, localHint);
          if (syncResult?.user) {
            // Backend returned confirmed role + status — use them as SOT
            backendRole = syncResult.user.role === 'user' ? 'customer' : syncResult.user.role;
            backendIsActive = syncResult.user.is_active !== false; // default true if missing
            setUserRole(backendRole);
            localStorage.setItem('lumora_active_role', backendRole);
            if (!backendIsActive) {
              setIsAccountDisabled(true);
            } else {
              setIsAccountDisabled(false);
            }
          } else {
            console.warn('[AuthContext] syncWithBackend returned null. Falling back to local active role hint.');
            backendRole = localHint;
            setUserRole(backendRole);
            localStorage.setItem('lumora_active_role', backendRole);
          }
        } catch (e) {
          console.warn('[AuthContext] Backend sync failed — falling back to Firestore:', e.message);
          // Fallback: try Firestore (NOT localStorage — stale role could be wrong user)
          try {
            const userRef = doc(db, 'users', firebaseUser.uid);
            const snap = await getDoc(userRef);
            if (snap.exists()) {
              const firestoreRole = snap.data().role || 'customer';
              backendRole = firestoreRole === 'user' ? 'customer' : firestoreRole;
              setUserRole(backendRole);
              localStorage.setItem('lumora_active_role', backendRole);
            } else {
              // Unknown user — default to customer (safest)
              setUserRole('customer');
              localStorage.setItem('lumora_active_role', 'customer');
            }
          } catch (fsErr) {
            console.warn('[AuthContext] Firestore fallback failed:', fsErr.message);
            // Last resort: customer (never vendor/admin from stale storage)
            setUserRole('customer');
          }
        }

        // User synced successfully

      } else {
        // ── No Firebase user — clear ALL session state ────────────────────────
        // BUG FIX: clearBackendToken() now also removes lumora_active_role and
        // lumora_user, preventing stale role from persisting to the next login.
        setUser(null);
        setUserRole(null);
        setIsAccountDisabled(false);
        clearBackendToken(); // clears: backend_token, backend_uid, active_role, user
        try { sessionStorage.clear(); } catch (_) {}
      }

      // ── CRITICAL: setLoading(false) is ALWAYS called last ────────────────
      // ProtectedRoute only evaluates after loading = false.
      // This guarantees userRole is set from the backend before any route guard runs.
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  /** Registration with email/password - supports multi-role */
  const register = async (fullName, email, password, role = 'user') => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role === 'user' ? 'customer' : role;
    let firebaseUser;
    
    try {
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      firebaseUser = cred.user;
      await firebaseUpdateProfile(firebaseUser, { displayName: fullName });
      try {
        await sendEmailVerification(firebaseUser);
      } catch (verifyError) {
        console.error("Verification email failed:", verifyError);
      }
    } catch (createErr) {
      if (createErr.code === 'auth/email-already-in-use') {
        const err = new Error('An account with this email already exists. Please sign in instead.');
        err.code = 'auth/email-already-in-use';
        throw err;
      } else {
        throw createErr;
      }
    }

    const userRef = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userRef);
    let currentRoles = [];
    if (userSnap.exists()) {
      currentRoles = userSnap.data().roles || [userSnap.data().role || 'customer'];
    }
    const updatedRoles = Array.from(new Set([...currentRoles, normalizedRole]));

    const userData = {
      uid: firebaseUser.uid,
      fullName,
      email: firebaseUser.email,
      photoURL: firebaseUser.photoURL || null,
      provider: 'password',
      emailVerified: firebaseUser.emailVerified,
      updatedAt: serverTimestamp(),
      accountStatus: 'active',
      role: normalizedRole,
      roles: updatedRoles,
      loginCount: userSnap.exists() ? (userSnap.data().loginCount || 0) : 0,
    };

    if (!userSnap.exists()) {
      userData.createdAt = serverTimestamp();
      userData.lastLoginAt = null;
      userData.phoneNumber = null;
      userData.country = null;
      userData.timezone = null;
      await setDoc(userRef, userData);
    } else {
      await updateDoc(userRef, userData);
    }

    // Write specific profile to its distinct database collection
    const specificData = {
      uid: firebaseUser.uid,
      fullName,
      email: firebaseUser.email,
      role: normalizedRole,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (normalizedRole === 'vendor') {
      await setDoc(doc(db, 'vendors', firebaseUser.uid), specificData);
    } else if (normalizedRole === 'affiliate') {
      // Auto create or reuse affiliate doc
      const affDocRef = doc(db, 'affiliates', firebaseUser.uid);
      const affDocSnap = await getDoc(affDocRef);
      if (!affDocSnap.exists()) {
     // Generate a unique code without reading the entire affiliates collection
        // (collection-level getDocs is denied by Firestore rules for non-admins)
        const code = 'AFF' + Date.now().toString(36).toUpperCase().slice(-6);
        await setDoc(affDocRef, {
          userId: firebaseUser.uid,
          affiliateCode: code,
          status: 'active',
          commissionRate: 30,
          totalClicks: 0,
          totalConversions: 0,
          totalRevenue: 0,
          totalCommission: 0,
          pendingCommission: 0,
          paidCommission: 0,
          createdAt: new Date().toISOString(),
          fullName,
          email: firebaseUser.email,
        });
      }
    } else {
      await setDoc(doc(db, 'customers', firebaseUser.uid), specificData);
    }

    await syncWithBackend(firebaseUser, normalizedRole);
    await logAuthEvent(firebaseUser.uid, firebaseUser.email, 'registration', true);
    return firebaseUser;
  };

  /** Login with optional Remember Me */
  const login = async (email, password, rememberMe = false, role = null) => {
    const normalizedEmail = email.trim().toLowerCase();
    // Destroy any previous session & clear local caches before authenticating new user
    try { if (auth.currentUser) { await signOut(auth); } } catch (_) {}
    clearBackendToken();
    try { sessionStorage.clear(); } catch (_) {}
    setUser(null);
    setUserRole(null);
    setIsAccountDisabled(false);
    setIsPlatformPaused(false);

    try {
      // ── PRE-SET active role BEFORE Firebase sign-in ───────────────────────
      // CRITICAL: onAuthStateChanged fires immediately after signInWithEmailAndPassword
      // resolves. If lumora_active_role still holds a stale value from a previous
      // session (e.g. 'vendor' when user is now logging in as 'customer'), the
      // onAuthStateChanged handler will read 'vendor' and issue a JWT with the
      // wrong active_role. Setting the hint FIRST eliminates this race condition.
      const normalizedPreRole = (role && role !== 'user') ? role : 'customer';
      localStorage.setItem('lumora_active_role', normalizedPreRole);

      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const firebaseUser = cred.user;
      
      try {
        await reload(firebaseUser);
      } catch (reloadErr) {
        console.error('LOGIN: reload failed (non-fatal)', reloadErr);
      }

      let snap = null;
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          const accountStatus = (data.accountStatus || data.status || 'active').toLowerCase();
          if (accountStatus === 'disabled' || accountStatus === 'suspended' || accountStatus === 'rejected') {
            await signOut(auth);
            await logAuthEvent(firebaseUser.uid, firebaseUser.email, 'login', false, 'Your account has been suspended by the Platform Administrator.');
            const err = new Error('Your account has been suspended by the Platform Administrator.');
            err.code = 'auth/user-disabled';
            throw err;
          }
          await updateDoc(userRef, {
            lastLoginAt: serverTimestamp(),
            loginCount: increment(1),
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            fullName: firebaseUser.displayName || '',
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL || null,
            provider: 'password',
            emailVerified: firebaseUser.emailVerified,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            accountStatus: 'active',
            role: 'user',
            roles: ['customer'],
            loginCount: 1,
            phoneNumber: firebaseUser.phoneNumber || null,
            country: null,
            timezone: null,
          });
        }
      } catch (e) {
        console.error('LOGIN: Firestore update failed (non-fatal)', e);
      }
      await logAuthEvent(firebaseUser.uid, firebaseUser.email, 'login', true);
      
      // Role validation
      if (role && snap && snap.exists()) {
        const data = snap.data();
        const roles = data.roles || [data.role || 'customer'];
        const normalizedTarget = role === 'user' ? 'customer' : role;
        
        let hasRole = roles.includes(normalizedTarget);
        if (!hasRole) {
          if (normalizedTarget === 'affiliate') {
            const affSnap = await getDoc(doc(db, 'affiliates', firebaseUser.uid));
            if (affSnap.exists()) hasRole = true;
          } else if (normalizedTarget === 'vendor') {
            const venSnap = await getDoc(doc(db, 'vendors', firebaseUser.uid));
            if (venSnap.exists()) hasRole = true;
          } else if (normalizedTarget === 'customer') {
            const custSnap = await getDoc(doc(db, 'customers', firebaseUser.uid));
            if (custSnap.exists()) hasRole = true;
          }
        }
 
        if (!hasRole) {
          await signOut(auth);
          await logAuthEvent(firebaseUser.uid, firebaseUser.email, 'login', false, `Role mismatch: User does not have ${role} role`);
          const err = new Error('Role mismatch');
          err.code = 'auth/role-mismatch';
          err.role = role;
          throw err;
        }
        
        localStorage.setItem('lumora_active_role', normalizedTarget);
        setUserRole(normalizedTarget);
      } else if (role) {
        const normalizedTarget = role === 'user' ? 'customer' : role;
        localStorage.setItem('lumora_active_role', normalizedTarget);
        setUserRole(normalizedTarget);
      }
      
      await logAuthEvent(firebaseUser.uid, firebaseUser.email, 'login', true);
      return firebaseUser;
    } catch (error) {
      await logAuthEvent(null, normalizedEmail, 'login', false, error.message);
      throw error;
    }
  };



  /** Logout — production-level full session teardown */
  async function logout() {
    const wasAdmin = userRole === 'admin';

    // 1. Log the event BEFORE signing out (token still valid)
    if (auth.currentUser) {
      try {
        await logAuthEvent(auth.currentUser.uid, auth.currentUser.email, 'logout', true);
      } catch (_) {}
    }

    // 2. Clear React state immediately
    setIsAccountDisabled(false);
    setIsPlatformPaused(false);
    setUser(null);
    setUserRole(null);

    // 3. Clear ALL auth-related storage in one call
    //    clearBackendToken() now removes: backend_token, backend_uid, active_role, user
    clearBackendToken();

    // 4. Clear sessionStorage (catches any session-scoped auth state)
    try { sessionStorage.clear(); } catch (_) {}

    // 5. Sign out of Firebase
    try { await signOut(auth); } catch (_) {}

    // 6. Redirect using replace() — removes the current page from browser history
    //    so pressing Back does NOT re-open the protected dashboard.
    //    All roles are redirected (not just admin).
    const target = wasAdmin ? '/admin/login' : '/';
    window.location.replace(target);
  };

  /** Google sign‑in — LOGIN ONLY. Will reject if no Firestore account exists. */
  const googleSignIn = async (rememberMe = false, role = null) => {
    // Destroy any previous session & clear local caches before authenticating new user
    try { if (auth.currentUser) { await signOut(auth); } } catch (_) {}
    clearBackendToken();
    try { sessionStorage.clear(); } catch (_) {}
    setUser(null);
    setUserRole(null);
    setIsAccountDisabled(false);
    setIsPlatformPaused(false);

    // PRE-SET active role before Firebase sign-in to prevent race condition
    const normalizedPreRole = (role && role !== 'user') ? role : 'customer';
    localStorage.setItem('lumora_active_role', normalizedPreRole);

    const provider = new GoogleAuthProvider();
    const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;
    const userRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // No Firestore account — reject immediately, sign out, do NOT create a document
      await signOut(auth);
      await logAuthEvent(firebaseUser.uid, firebaseUser.email, 'google_login', false, 'Account does not exist. Please register first.');
      const err = new Error('Account does not exist. Please register first.');
      err.code = 'auth/account-not-found';
      throw err;
    }

    const data = snap.data();
    const accountStatus = (data.accountStatus || data.status || 'active').toLowerCase();
    if (accountStatus === 'disabled' || accountStatus === 'suspended' || accountStatus === 'rejected') {
      await signOut(auth);
      await logAuthEvent(firebaseUser.uid, firebaseUser.email, 'google_login', false, 'Your account has been suspended by the Platform Administrator.');
      const err = new Error('Your account has been suspended by the Platform Administrator.');
      err.code = 'auth/user-disabled';
      throw err;
    }

    // Account exists — allow login
    await updateDoc(userRef, {
      lastLoginAt: serverTimestamp(),
      loginCount: increment(1),
      updatedAt: serverTimestamp(),
    });

    // Optional role validation
    if (role) {
      const data = snap.data();
      const roles = data.roles || [data.role || 'customer'];
      const normalizedTarget = role === 'user' ? 'customer' : role;
      
      let hasRole = roles.includes(normalizedTarget);
      if (!hasRole) {
        if (normalizedTarget === 'affiliate') {
          const affSnap = await getDoc(doc(db, 'affiliates', firebaseUser.uid));
          if (affSnap.exists()) hasRole = true;
        } else if (normalizedTarget === 'vendor') {
          const venSnap = await getDoc(doc(db, 'vendors', firebaseUser.uid));
          if (venSnap.exists()) hasRole = true;
        } else if (normalizedTarget === 'customer') {
          const custSnap = await getDoc(doc(db, 'customers', firebaseUser.uid));
          if (custSnap.exists()) hasRole = true;
        }
      }

      if (!hasRole) {
        await signOut(auth);
        await logAuthEvent(firebaseUser.uid, firebaseUser.email, 'google_login', false, `Role mismatch: User does not have ${role} role`);
        const err = new Error(`This account is not registered as a ${role}.`);
        err.code = 'auth/role-mismatch';
        err.role = role;
        throw err;
      }
      
      localStorage.setItem('lumora_active_role', normalizedTarget);
      setUserRole(normalizedTarget);
    }

    await logAuthEvent(firebaseUser.uid, firebaseUser.email, 'google_login', true);
    return firebaseUser;
  };

  /** GitHub sign‑in — LOGIN ONLY. Will reject if no Firestore account exists. */
  const githubSignIn = async (rememberMe = false, role = null) => {
    // Destroy any previous session & clear local caches before authenticating new user
    try { if (auth.currentUser) { await signOut(auth); } } catch (_) {}
    clearBackendToken();
    try { sessionStorage.clear(); } catch (_) {}
    setUser(null);
    setUserRole(null);
    setIsAccountDisabled(false);
    setIsPlatformPaused(false);

    try {
      // PRE-SET active role before Firebase sign-in to prevent race condition
      const normalizedPreRole = (role && role !== 'user') ? role : 'customer';
      localStorage.setItem('lumora_active_role', normalizedPreRole);

      const provider = new GithubAuthProvider();
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const email = firebaseUser.email || ''; // GitHub accounts with private email return null
      const userRef = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        // No Firestore account — reject immediately, sign out, do NOT create a document
        await signOut(auth);
        await logAuthEvent(firebaseUser.uid, email, 'github_login', false, 'Account does not exist. Please register first.');
        const err = new Error('Account does not exist. Please register first.');
        err.code = 'auth/account-not-found';
        throw err;
      }

      const data = snap.data();
      const accountStatus = (data.accountStatus || data.status || 'active').toLowerCase();
      if (accountStatus === 'disabled' || accountStatus === 'suspended' || accountStatus === 'rejected') {
        await signOut(auth);
        await logAuthEvent(firebaseUser.uid, email, 'github_login', false, 'Your account has been suspended by the Platform Administrator.');
        const err = new Error('Your account has been suspended by the Platform Administrator.');
        err.code = 'auth/user-disabled';
        throw err;
      }

      // Account exists — allow login
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        loginCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      // Optional role validation
      if (role) {
        const data = snap.data();
        const roles = data.roles || [data.role || 'customer'];
        const normalizedTarget = role === 'user' ? 'customer' : role;
        
        let hasRole = roles.includes(normalizedTarget);
        if (!hasRole) {
          if (normalizedTarget === 'affiliate') {
            const affSnap = await getDoc(doc(db, 'affiliates', firebaseUser.uid));
            if (affSnap.exists()) hasRole = true;
          } else if (normalizedTarget === 'vendor') {
            const venSnap = await getDoc(doc(db, 'vendors', firebaseUser.uid));
            if (venSnap.exists()) hasRole = true;
          } else if (normalizedTarget === 'customer') {
            const custSnap = await getDoc(doc(db, 'customers', firebaseUser.uid));
            if (custSnap.exists()) hasRole = true;
          }
        }

        if (!hasRole) {
          await signOut(auth);
          await logAuthEvent(firebaseUser.uid, email, 'github_login', false, `Role mismatch: User does not have ${role} role`);
          const err = new Error(`This account is not registered as a ${role}.`);
          err.code = 'auth/role-mismatch';
          err.role = role;
          throw err;
        }
        
        localStorage.setItem('lumora_active_role', normalizedTarget);
        setUserRole(normalizedTarget);
      }

      await logAuthEvent(firebaseUser.uid, email, 'github_login', true);
      return firebaseUser;
    } catch (error) {
      // Re-throw errors we already handled above (account-not-found, role-mismatch)
      if (error.code === 'auth/account-not-found' || error.code === 'auth/role-mismatch') {
        throw error;
      }
      console.error("═══════════════════════════════════════════");
      console.error("[GITHUB LOGIN] FATAL ERROR – Login failed");
      console.error("[GITHUB LOGIN] Error code:", error.code);
      console.error("[GITHUB LOGIN] Error message:", error.message);
      console.error("═══════════════════════════════════════════");
      await logAuthEvent(null, null, 'github_login', false, error.message);
      throw error;
    }
  };

  /** Send password‑reset email */
  const sendPasswordReset = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      await logAuthEvent(null, normalizedEmail, 'password_reset', true);
    } catch (e) {
      await logAuthEvent(null, normalizedEmail, 'password_reset', false, e.message);
      throw e;
    }
  };

  /** Resend verification email */
  const resendVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  /** Reload current user (useful after email verification) */
  const reloadUser = async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    setUser(auth.currentUser);
    // If email now verified, sync to Firestore
    if (auth.currentUser.emailVerified) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          emailVerified: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Failed to update emailVerified in Firestore', err);
      }
    }
  };

  /** Update user profile state locally, in Firebase Auth, and Backend */
  const updateProfile = async (profileData) => {
    // 1. Update Firebase Auth Profile
    if (auth.currentUser && (profileData.displayName || profileData.name || profileData.photoURL || profileData.avatar)) {
      try {
        await firebaseUpdateProfile(auth.currentUser, {
          displayName: profileData.displayName || profileData.name || auth.currentUser.displayName,
          photoURL: profileData.photoURL || profileData.avatar || auth.currentUser.photoURL
        });
      } catch (err) {
        console.error('Failed to update Firebase profile', err);
      }
    }

    // 2. Update Backend
    if (profileData.displayName || profileData.name) {
      try {
        await backendFetch('/auth/me', {
          method: 'PUT',
          body: JSON.stringify({ name: profileData.displayName || profileData.name })
        });
      } catch (err) {
        console.warn('Failed to update backend profile', err);
      }
    }

    // 3. Update React State and localStorage
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...profileData };
      updated.displayName = profileData.displayName || profileData.name || prev.displayName;
      updated.photoURL = profileData.photoURL || profileData.avatar || prev.photoURL;
      
      return updated;
    });
  };

  const value = {
    user,
    userRole,
    updateRole,
    loading,
    register,
    login,
    logout,
    googleSignIn,
    githubSignIn,
    sendPasswordReset,
    resendVerification,
    reloadUser,
    updateProfile,
    isAccountDisabled,
    isPlatformPaused,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
