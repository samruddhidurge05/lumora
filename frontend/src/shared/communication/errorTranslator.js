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
      title: "Something went wrong",
      message: "We couldn't process this request right now.",
      recovery: "Please try again. If the issue continues, contact support.",
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
      title: "Incorrect email or password",
      message: "The details entered do not match our records.",
      recovery: "Please check your email and password and try again.",
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
      title: "Admin access required",
      message: "You don't have permission to perform this action.",
      recovery: "Please sign in with an authorized account or contact support.",
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
      message: "Your session has expired.",
      recovery: "Please sign in again to continue.",
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
      message: "The sign-in window was closed before completing.",
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
      recovery: "Please allow pop-ups for this site and try signing in again.",
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
      title: "Connection issue",
      message: "We couldn't reach the servers right now.",
      recovery: "Check your internet connection and try again.",
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
      message: "Something went wrong on our end.",
      recovery: "Please wait a moment and try again.",
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
      title: "Upload issue",
      message: "We couldn't complete the file upload right now.",
      recovery: "Please check your file size and format, then try again.",
      statusText: "Transfer Delayed",
    };
  }

  // ── 5. Default Clean Error Fallback ──────────────────────────────────
  return {
    title: "Something went wrong",
    message: "We couldn't process this request right now.",
    recovery: "Please try again. If the issue continues, contact support.",
    statusText: "Action Interrupted",
  };
};
