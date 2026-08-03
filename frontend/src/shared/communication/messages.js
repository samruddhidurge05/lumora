/**
 * admin-app/src/shared/communication/messages.js
 * ────────────────────────────────────────────────
 * Enterprise UX Experience Layer — Core Messaging System
 *
 * Provides standardized system messages across Success, Info, Warning, Error, and Recovery.
 */

export const systemMessages = {
  success: {
    adminActivated: "Admin access is now active.",
    paymentUpdated: "Payment info updated.",
    productPublished: "Product published to marketplace.",
    settingsSaved: "Settings saved successfully.",
  },
  info: {
    preparingWorkspace: "Loading...",
    loadingData: "Loading your data...",
    establishingSession: "Signing in...",
    syncingUpdates: "Updating your data...",
  },
  warning: {
    temporarilyUnavailable: "Some information is temporarily unavailable.",
    connectionUnstable: "Your connection seems unstable. Trying to reconnect...",
    syncPaused: "Sync paused. Reconnecting...",
  },
  error: {
    requestFailed: "Something went wrong. Please try again.",
    serviceUnavailable: "Service is temporarily unavailable.",
    unableToLoad: "Couldn't load this data right now.",
    permissionDenied: "You don't have access to do this.",
    sessionExpired: "Your session expired. Please sign in again.",
  },
  recovery: {
    standard: "Something went wrong. Please try again. If the issue continues, contact support.",
    refreshPage: "Please refresh the page. If the issue continues, contact support.",
    checkConnection: "Please check your internet connection and try again.",
  },
};
