/**
 * admin-app/src/shared/communication/messages.js
 * ────────────────────────────────────────────────
 * Enterprise UX Experience Layer — Core Messaging System
 *
 * Provides standardized system messages across Success, Info, Warning, Error, and Recovery.
 */

export const systemMessages = {
  success: {
    adminActivated: "Administrator access is active.",
    paymentUpdated: "Payment settings updated.",
    productPublished: "Product published to marketplace.",
    settingsSaved: "Settings saved successfully.",
  },
  info: {
    preparingWorkspace: "Loading Admin Panel...",
    loadingData: "Loading data...",
    establishingSession: "Signing in...",
    syncingUpdates: "Updating...",
  },
  warning: {
    temporarilyUnavailable: "Some information is temporarily unavailable.",
    connectionUnstable: "Connection unstable. Attempting to reconnect automatically.",
    syncPaused: "Sync paused. Reconnecting...",
  },
  error: {
    requestFailed: "Unable to complete request right now.",
    serviceUnavailable: "Service is temporarily unavailable.",
    unableToLoad: "Unable to load information right now.",
    permissionDenied: "You don't have permission to perform this action.",
    sessionExpired: "Your session has expired. Please sign in again.",
  },
  recovery: {
    standard: "An error occurred. Please try again or contact support.",
    refreshPage: "Please refresh the page. If the issue continues, contact support.",
    checkConnection: "Please check your network connection and try again.",
  },
};
