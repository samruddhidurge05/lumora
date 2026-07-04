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

    // One-time check: only runs once per user session
    if (!statusCheckDoneRef.current) {
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
        .catch(() => {});
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

  useEffect(() => {
    if (!user) return;

    const poll = async () => {
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
      } catch (_) {
        // Non-fatal — backend may be temporarily unreachable
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

        // ── Admin branch: if hint is 'admin', use Firebase ID token flow ────
        // Skip firebase-sync entirely for admin — call adminLogin instead.
        if (localHint === 'admin') {
          try {
            await adminLogin(firebaseUser);
            setUserRole('admin');
            localStorage.setItem('lumora_active_role', 'admin');
          } catch (adminErr) {
            console.warn('[AuthContext] Admin session restore failed:', adminErr.message);
            await signOut(auth);
            clearBackendToken();
            window.location.href = '/admin/login';
            return;
          }
          setLoading(false);
          return; // do NOT call syncWithBackend for admin
        }

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
        setUser(null);
        setUserRole(null);
        setIsAccountDisabled(false);
        localStorage.removeItem('lumora_user');
        clearBackendToken();
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
    const wasAdmin = userRole === 'admin';
    setIsAccountDisabled(false);
    setIsPlatformPaused(false);
    if (auth.currentUser) {
      await logAuthEvent(auth.currentUser.uid, auth.currentUser.email, 'logout', true);
    }
    clearBackendToken();   // remove lumora_backend_token + lumora_backend_uid
    await signOut(auth);
    if (wasAdmin) {
      window.location.href = '/admin/login';
    }
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
