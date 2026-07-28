/**
 * admin-app/src/shared/communication/messages.js
 * ────────────────────────────────────────────────
 * Enterprise UX Experience Layer — Core Messaging System
 *
 * Provides standardized system messages across Success, Info, Warning, Error, and Recovery.
 */

export const systemMessages = {
  success: {
    adminActivated: "Administrator access is now active.",
    paymentUpdated: "Payment information has been updated.",
    productPublished: "Product has been published to the marketplace.",
    settingsSaved: "Workspace configuration updated successfully.",
  },
  info: {
    preparingWorkspace: "Preparing workspace...",
    loadingData: "Loading your data...",
    establishingSession: "Establishing secure session...",
    syncingUpdates: "Syncing workspace updates...",
  },
  warning: {
    temporarilyUnavailable: "Some information may be temporarily unavailable.",
    connectionUnstable: "Your connection appears unstable. We're attempting to reconnect automatically.",
    syncPaused: "Synchronization paused. We're reconnecting automatically.",
  },
  error: {
    requestFailed: "We couldn't complete your request right now.",
    serviceUnavailable: "The service is temporarily unavailable.",
    unableToLoad: "We couldn't load this information right now.",
    permissionDenied: "You don't have access to perform this action in this workspace.",
    sessionExpired: "Your secure session has expired. Please sign in again.",
  },
  recovery: {
    standard: "Something interrupted this operation. Please try again. If the problem continues, contact your administrator.",
    refreshPage: "Please refresh the page. If the issue continues, contact your system administrator.",
    checkConnection: "Please check your network connection and try again.",
  },
};
