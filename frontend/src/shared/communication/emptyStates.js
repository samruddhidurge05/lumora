/**
 * admin-app/src/shared/communication/emptyStates.js
 * ───────────────────────────────────────────────────
 * Enterprise UX Experience Layer — Contextual Empty States
 *
 * Replaces generic "No data" strings with contextual, encouraging,
 * action-oriented SaaS copy per domain area.
 */

export const emptyStates = {
  orders: {
    title: "No orders yet",
    description: "Orders will appear here automatically once customers begin purchasing from your marketplace.",
    actionText: "View Products Catalog",
  },
  products: {
    title: "Your catalog is empty",
    description: "Publish your first product to begin offering digital goods on the marketplace.",
    actionText: "Add Product",
  },
  customers: {
    title: "No customer accounts found",
    description: "Customer profiles will be created here when shoppers register or place orders.",
    actionText: "Refresh Directory",
  },
  vendors: {
    title: "No vendor accounts found",
    description: "Vendor applications and active storefront accounts will appear here.",
    actionText: "Invite Vendor",
  },
  affiliates: {
    title: "No affiliate partners yet",
    description: "Invite affiliates to promote your products and expand marketplace reach.",
    actionText: "Create Affiliate Campaign",
  },
  payments: {
    title: "No payment activity recorded",
    description: "Completed transactions, payouts, and financial records will be listed here.",
    actionText: "Refresh Financials",
  },
  reviews: {
    title: "No reviews submitted yet",
    description: "Customer feedback and product ratings will appear here as buyers share reviews.",
    actionText: "View Products",
  },
  riskAudit: {
    title: "All security checks clear",
    description: "No risk flags or suspicious account activities detected. Platform fully secured.",
    actionText: "Run Audit Check",
  },
  liveFeed: {
    title: "No recent live activity",
    description: "Real-time order events, sales, and platform updates will stream here automatically.",
    actionText: null,
  },
  auditLog: {
    title: "No recent admin activity",
    description: "Administrative changes and team actions will be audited and displayed here.",
    actionText: null,
  },
  invitations: {
    title: "No active team invitations",
    description: "Pending administrative invitations will be managed here.",
    actionText: "Invite Administrator",
  },
};
