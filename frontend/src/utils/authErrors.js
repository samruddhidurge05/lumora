/**
 * authErrors.js
 * Maps Firebase auth error codes to user-friendly messages.
 * Kept in a separate utility file so AuthContext only exports
 * React components/hooks (required for Vite Fast Refresh).
 */
export function mapAuthError(code) {
  switch (code) {
    case 'auth/user-not-found':       return 'No account found with this email.';
    case 'auth/wrong-password':       return 'Incorrect password.';
    case 'auth/invalid-credential':   return 'Email or password is incorrect.';
    case 'auth/invalid-email':        return 'Please enter a valid email address.';
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/too-many-requests':    return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed': return 'Network error. Please check your connection.';
    case 'auth/user-disabled':        return 'This account has been disabled.';
    case 'auth/role-mismatch':        return 'This account is not registered for this role.';
    case 'auth/account-not-found':    return 'No account found. Please register first.';
    case 'auth/popup-closed-by-user': return 'Sign-in popup was closed. Please try again.';
    case 'auth/cancelled-popup-request': return 'Another sign-in popup is already open.';
    default:                          return 'Authentication error. Please try again.';
  }
}
