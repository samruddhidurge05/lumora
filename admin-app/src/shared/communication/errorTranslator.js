/**
 * admin-app/src/shared/communication/errorTranslator.js
 * ────────────────────────────────────────────────────────
 * Enterprise UX Experience Layer — Centralized Error Translator
 *
 * Translates raw Firebase, Axios, HTTP 401/403/404/500, network failure,
 * and SDK errors into calm, human-friendly, actionable SaaS error objects.
 *
 * @param {Error|object|string} error  The caught error object or string
 * @returns {{ title: string, message: string, recovery: string, statusText: string }}
 */

export const getFriendlyError = (error) => {
  if (!error) {
    return {
      title: "Unable to complete request",
      message: "We couldn't process this action right now.",
      recovery: "Please try again. If the issue continues, contact your workspace administrator.",
      statusText: "Action Interrupted",
    };
  }

  const rawMessage = typeof error === 'string' 
    ? error 
    : (error.message || error.detail || error.error || '').toString();

  const code = (error.code || error.status || '').toString().toLowerCase();

  // ── 1. Authentication & Session Expiry ────────────────────────────────────
  if (
    code.includes('auth/invalid-credential') ||
    code.includes('auth/wrong-password') ||
    code.includes('auth/user-not-found') ||
    rawMessage.toLowerCase().includes('invalid credential') ||
    rawMessage.toLowerCase().includes('wrong password')
  ) {
    return {
      title: "Incorrect credentials",
      message: "The email or password entered does not match our records.",
      recovery: "Please double-check your credentials and try again.",
      statusText: "Sign-in Failed",
    };
  }

  if (
    code.includes('403') ||
    rawMessage.toLowerCase().includes('only administrators') ||
    rawMessage.toLowerCase().includes('not authorised') ||
    rawMessage.toLowerCase().includes('not authorized') ||
    rawMessage.toLowerCase().includes('no account found')
  ) {
    return {
      title: "Administrator access required",
      message: "You don't have permission to perform this action in this workspace.",
      recovery: "Please sign in with an authorized administrator account or contact your team owner.",
      statusText: "Access Restricted",
    };
  }

  if (
    code.includes('401') ||
    rawMessage.toLowerCase().includes('jwt expired') ||
    rawMessage.toLowerCase().includes('session expired') ||
    rawMessage.toLowerCase().includes('unauthorized')
  ) {
    return {
      title: "Session expired",
      message: "Your secure session has expired.",
      recovery: "Please sign in again to continue managing your workspace.",
      statusText: "Authentication Required",
    };
  }

  // ── 2. Firebase & OAuth Popup Interruption ─────────────────────────────────
  if (
    code.includes('auth/popup-closed-by-user') ||
    rawMessage.toLowerCase().includes('popup-closed-by-user')
  ) {
    return {
      title: "Sign-in cancelled",
      message: "The authentication window was closed before sign-in completed.",
      recovery: "Click 'Sign in with Google' to try again.",
      statusText: "Cancelled",
    };
  }

  if (
    code.includes('auth/popup-blocked') ||
    rawMessage.toLowerCase().includes('popup-blocked')
  ) {
    return {
      title: "Pop-up window blocked",
      message: "Your browser blocked the sign-in pop-up window.",
      recovery: "Please allow pop-ups for this domain and try signing in again.",
      statusText: "Pop-up Blocked",
    };
  }

  // ── 3. Network & Service Availability ─────────────────────────────────────
  if (
    code.includes('network') ||
    rawMessage.toLowerCase().includes('failed to fetch') ||
    rawMessage.toLowerCase().includes('network request failed') ||
    rawMessage.toLowerCase().includes('networkerror')
  ) {
    return {
      title: "Service temporarily unreachable",
      message: "We couldn't reach the platform services right now.",
      recovery: "Check your internet connection. We'll attempt to reconnect automatically.",
      statusText: "Connection Unstable",
    };
  }

  if (
    code.includes('500') ||
    code.includes('502') ||
    code.includes('503') ||
    rawMessage.toLowerCase().includes('internal server error') ||
    rawMessage.toLowerCase().includes('backend unavailable')
  ) {
    return {
      title: "Service temporarily unavailable",
      message: "Something unexpected happened while processing your request.",
      recovery: "Please wait a moment and try again. Our systems will recover automatically.",
      statusText: "System Busy",
    };
  }

  // ── 4. Storage & File Management ──────────────────────────────────────────
  if (
    rawMessage.toLowerCase().includes('storage') ||
    rawMessage.toLowerCase().includes('upload') ||
    rawMessage.toLowerCase().includes('b2')
  ) {
    return {
      title: "File operation delayed",
      message: "We couldn't complete the file transfer at this moment.",
      recovery: "Please verify file size and format, then try uploading again.",
      statusText: "Transfer Delayed",
    };
  }

  // ── 5. Default Clean SaaS Error Fallback ──────────────────────────────────
  return {
    title: "Unable to complete request",
    message: "We couldn't complete this request right now.",
    recovery: "Please try again. If the issue continues, contact your workspace administrator.",
    statusText: "Action Interrupted",
  };
};
