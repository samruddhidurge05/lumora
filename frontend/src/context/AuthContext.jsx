/* src/context/AuthContext.jsx */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../services/firebase';
import { syncWithBackend, clearBackendToken } from '../services/authService';
import { backendFetch, registerGlobalErrorListener } from '../utils/api';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
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
  signInAnonymously,
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

/** Helper to log auth events to Firestore */
const logAuthEvent = async (uid, email, eventType, success, failureReason = null) => {
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
  } catch (e) {
    console.error('Failed to log auth event', e);
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

  useEffect(() => {
    if (!user) {
      setIsAccountDisabled(false);
      return;
    }

    const isMockAdminActive = !!localStorage.getItem('lumora_mock_user');
    if (isMockAdminActive || userRole === 'admin') {
      setIsAccountDisabled(false);
      return;
    }

    // One-time fallback check against SQLite backend on load/change
    // Also updates role from backend in case it changed (e.g. admin role assignment)
    backendFetch('/auth/me')
      .then(session => {
        if (session) {
          if (!session.is_active) {
            setIsAccountDisabled(true);
          }
          // Keep role in sync with backend SOT
          if (session.role && session.role !== 'user') {
            const backendRole = session.role;
            setUserRole(backendRole);
            localStorage.setItem('lumora_active_role', backendRole);
          }
        }
      })
      .catch(() => {});

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
  }, [user, userRole]);

  // Helper to change role manually
  const updateRole = (newRole) => {
    const norm = newRole === 'user' ? 'customer' : newRole;
    setUserRole(norm);
    localStorage.setItem('lumora_active_role', norm);
  };

  // Observe auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // ── Admin mock session path (no Firebase user) ──────────────────────
      const isMockAdminActive = !!localStorage.getItem('lumora_mock_user');
      if (isMockAdminActive) {
        const storedMock = localStorage.getItem('lumora_mock_user');
        if (storedMock) {
          try {
            const parsed = JSON.parse(storedMock);
            if (firebaseUser) parsed.uid = firebaseUser.uid;
            setUser(parsed);
            setUserRole('admin');
            setIsAccountDisabled(false);
            // loading is already false for admin or will be set below
          } catch (e) {}
        }
        setLoading(false);
        return;
      }

      if (firebaseUser) {
        setUser(firebaseUser);

        // ── STEP 1: localStorage hint (temporary, will be overwritten) ──────
        // Use only as a fast hint so the UI can pre-warm while backend syncs.
        const localHint = localStorage.getItem('lumora_active_role');
        if (localHint && localHint !== 'customer') {
          // Only trust non-customer local hints to avoid stale 'customer' lock-in
          setUserRole(localHint === 'user' ? 'customer' : localHint);
        }

        // ── STEP 2: syncWithBackend — backend is the authoritative role SOT ─
        // setLoading(false) is deferred until AFTER this completes so
        // ProtectedRoute never renders with a stale / wrong role.
        let backendRole = null;
        let backendIsActive = true;
        try {
          const hintRole = localStorage.getItem('lumora_active_role') || 'customer';
          const syncResult = await syncWithBackend(firebaseUser, hintRole);
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
          }
        } catch (e) {
          console.warn('[AuthContext] Backend sync failed — falling back to localStorage/Firestore:', e.message);
          // Fallback: try Firestore, then localStorage
          try {
            const userRef = doc(db, 'users', firebaseUser.uid);
            const snap = await getDoc(userRef);
            if (snap.exists()) {
              const firestoreRole = snap.data().role || 'customer';
              backendRole = firestoreRole === 'user' ? 'customer' : firestoreRole;
              setUserRole(backendRole);
              localStorage.setItem('lumora_active_role', backendRole);
            } else if (localHint) {
              setUserRole(localHint === 'user' ? 'customer' : localHint);
            } else {
              setUserRole('customer');
            }
          } catch (fsErr) {
            console.warn('[AuthContext] Firestore fallback failed:', fsErr.message);
            setUserRole(localHint ? (localHint === 'user' ? 'customer' : localHint) : 'customer');
          }
        }

        // Sync minimal user info to localStorage for non-context consumers
        try {
          localStorage.setItem('lumora_user', JSON.stringify({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          }));
        } catch (e) {
          console.warn('[AuthContext] localStorage user sync failed:', e.message);
        }

      } else {
        // No Firebase user — clear all session state
        const mockUserStr = localStorage.getItem('lumora_mock_user');
        if (mockUserStr) {
          // Admin session was just cleared — shouldn't normally reach here since
          // admin mock path is handled above, but handle defensively.
          setUser(null);
          setUserRole(null);
          localStorage.removeItem('lumora_mock_user');
        } else {
          setUser(null);
          setUserRole(null);
          setIsAccountDisabled(false);
          localStorage.removeItem('lumora_user');
          clearBackendToken();
        }
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
    const normalizedRole = role === 'user' ? 'customer' : role;
    let firebaseUser;
    
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      firebaseUser = cred.user;
      await updateProfile(firebaseUser, { displayName: fullName });
      try {
        await sendEmailVerification(firebaseUser);
      } catch (verifyError) {
        console.error("Verification email failed:", verifyError);
      }
    } catch (createErr) {
      if (createErr.code === 'auth/email-already-in-use') {
        try {
          // Attempt to log in with this email and password to verify ownership
          const signInCred = await signInWithEmailAndPassword(auth, email, password);
          firebaseUser = signInCred.user;
        } catch (signInErr) {
          const err = new Error('This email is already in use by another account. Please enter the correct password to add this new role to your existing account.');
          err.code = 'auth/email-already-in-use';
          throw err;
        }
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
        const snapAffs = await getDocs(collection(db, 'affiliates'));
        const nextIndex = snapAffs.size + 1;
        const code = 'AFF' + String(nextIndex).padStart(3, '0');
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

    localStorage.setItem('lumora_active_role', normalizedRole);
    setUserRole(normalizedRole);
    await logAuthEvent(firebaseUser.uid, firebaseUser.email, 'registration', true);
    return firebaseUser;
  };

  /** Login with optional Remember Me */
  const login = async (email, password, rememberMe = false, role = null) => {
    if (email === 'admin@lumora.co' || email === 'admin@lumora.com' || email === 'admin@gmail.com') {
      // ── ALWAYS clear any stale token from a previous non-admin session ────
      // This prevents an old vendor/customer JWT from being sent to admin-only
      // endpoints and causing 403 errors on the fallback REST calls.
      localStorage.removeItem('lumora_backend_token');
      localStorage.removeItem('lumora_backend_uid');

      // ── Obtain a real Firebase session so Firestore operations succeed ──
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (fbErr) {
        console.warn('[admin-login] Firebase credential login failed, falling back to anonymous:', fbErr.message);
        try {
          await signInAnonymously(auth);
        } catch (anonErr) {
          console.warn('[admin-login] Firebase anonymous signin failed:', anonErr.message);
        }
      }

      const mockUser = {
        uid:           auth.currentUser?.uid || 'admin-mock-uid',
        email:         email,
        displayName:   'Platform Admin',
        emailVerified: true,
      };

      const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

      // Try the exact email the user typed first, then the canonical aliases.
      // This handles both admin@lumora.com (password: admin123) and
      // admin@lumora.co (password: Admin1234) transparently.
      const loginAttempts = [
        { email: email,              password: password },
        { email: 'admin@gmail.com',  password: password },
        { email: 'admin@lumora.com', password: password },
        { email: 'admin@lumora.co',  password: password },
        { email: 'admin@gmail.com',  password: 'admin123'  },
        { email: 'admin@lumora.com', password: 'admin123'  },
        { email: 'admin@lumora.co',  password: 'Admin1234' },
      ];

      // Deduplicate: keep first occurrence of each email+password pair
      const seen = new Set();
      const uniqueAttempts = loginAttempts.filter(a => {
        const key = a.email + '|' + a.password;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      let jwtObtained = false;
      try {
        // Fire all credential attempts IN PARALLEL — first success wins.
        // This eliminates the sequential latency (up to 7 × round-trip time).
        const winner = await Promise.any(
          uniqueAttempts.map(async (attempt) => {
            const res = await fetch(`${BACKEND_URL}/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: attempt.email, password: attempt.password }),
            });
            if (!res.ok) throw new Error(`${attempt.email}: HTTP ${res.status}`);
            const data = await res.json();
            if (!data.access_token || data.user?.role !== 'admin') {
              throw new Error(`${attempt.email}: not admin`);
            }
            return data;
          })
        );
        localStorage.setItem('lumora_backend_token', winner.access_token);
        if (winner.user?.id != null) {
          localStorage.setItem('lumora_backend_uid', String(winner.user.id));
        }
        window.dispatchEvent(new Event('lumora_backend_ready'));
        console.log('[admin-login] Backend JWT obtained id=', winner.user?.id);
        jwtObtained = true;
      } catch (_) {
        // AggregateError — all attempts failed
        console.warn('[admin-login] All login attempts failed — admin UI will load but API calls may return 401/403.');
      }

      if (!jwtObtained) {
        console.warn('[admin-login] Admin UI will load but API calls may return 401/403.');
      }

      setUser(mockUser);
      setUserRole('admin');
      localStorage.setItem('lumora_active_role', 'admin');
      localStorage.setItem('lumora_mock_user', JSON.stringify(mockUser));
      localStorage.setItem('lumora_user', JSON.stringify({
        uid:         mockUser.uid,
        email:       mockUser.email,
        displayName: mockUser.displayName,
      }));
      setLoading(false);
      return mockUser;
    }
    try {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      const cred = await signInWithEmailAndPassword(auth, email, password);
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
      console.error('═══════════════════════════════════════════');
      console.error('[LOGIN] FATAL ERROR – Login failed');
      console.error('[LOGIN] Error code:', error.code);
      console.error('[LOGIN] Error message:', error.message);
      console.error('═══════════════════════════════════════════');
      await logAuthEvent(null, email, 'login', false, error.message);
      throw error;
    }
  };



  /** Logout */
  const logout = async () => {
    setIsAccountDisabled(false);
    setIsPlatformPaused(false);
    localStorage.removeItem('lumora_mock_user');
    if (auth.currentUser) {
      await logAuthEvent(auth.currentUser.uid, auth.currentUser.email, 'logout', true);
    }
    clearBackendToken();   // remove lumora_backend_token + lumora_backend_uid
    await signOut(auth);
  };

  /** Google sign‑in — LOGIN ONLY. Will reject if no Firestore account exists. */
  const googleSignIn = async (rememberMe = false, role = null) => {
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
    try {
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
    try {
      await sendPasswordResetEmail(auth, email);
      await logAuthEvent(null, email, 'password_reset', true);
    } catch (e) {
      await logAuthEvent(null, email, 'password_reset', false, e.message);
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

  /** Update user profile state locally and in localStorage */
  const updateProfile = async (profileData) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...profileData };
      try {
        localStorage.setItem('lumora_user', JSON.stringify({
          uid: updated.uid,
          email: updated.email,
          displayName: updated.displayName || updated.fullName,
          photoURL: updated.photoURL || updated.avatar,
          ...profileData
        }));
      } catch (err) {
        console.error('updateProfile local sync failed', err);
      }
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
