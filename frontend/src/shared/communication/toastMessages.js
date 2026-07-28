/**
 * admin-app/src/shared/communication/toastMessages.js
 * ────────────────────────────────────────────────────
 * Enterprise UX Experience Layer — Standardized Toast Helpers
 *
 * Concise, non-intrusive notification copy for operations.
 */

export const toastMessages = {
  success: {
    productPublished: "✓ Product published",
    productUpdated: "✓ Product updated",
    changesSaved: "✓ Changes saved",
    invitationSent: "✓ Invitation sent",
    accessActivated: "✓ Administrator access activated",
    paymentApproved: "✓ Payment approved",
    payoutProcessed: "✓ Payout processed",
    customerUpdated: "✓ Customer updated",
    vendorApproved: "✓ Vendor partner approved",
    settingsSaved: "✓ Platform settings saved",
  },
  info: {
    preparingWorkspace: "Preparing workspace...",
    savingChanges: "Saving changes...",
    syncingUpdates: "Syncing workspace updates...",
    processing: "Processing request...",
  },
  warning: {
    serviceUnavailable: "⚠ Some services are temporarily unavailable.",
    verificationPending: "⚠ Changes couldn't be verified yet.",
    connectionInterrupted: "⚠ Connection interrupted. Reconnecting...",
    actionRequiresApproval: "⚠ Action requires approval",
  },
  error: {
    unableToComplete: "✕ We couldn't complete your request. Please try again.",
    accessDenied: "✕ You don't have permission to perform this action.",
    sessionExpired: "✕ Your secure session has expired. Please sign in again.",
  },
  offline: {
    banner: "You're offline. Some information may not be up to date. We'll reconnect automatically.",
  },
};
