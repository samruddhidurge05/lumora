/**
 * admin-app/src/shared/communication/healthLabels.js
 * ───────────────────────────────────────────────────
 * Enterprise UX Experience Layer — Platform Health & Status Labels
 *
 * Transforms raw engineering subsystem names (PostgreSQL DB, Firestore Sync,
 * Storage B2, Payment Gateway) into business-focused SaaS status capabilities.
 */

export const healthLabels = {
  sectionTitle: "Platform Status",
  sectionSubtitle: "CORE CAPABILITIES & SERVICE HEALTH",
  overallHeader: "Platform Status",
  overallStatus: "Healthy",
  overallBadge: "Operational",
  overallGrade: "Excellent",

  services: [
    {
      id: "core_services",
      name: "Core Services",
      legacyName: "PostgreSQL DB",
      status: "Healthy",
      badge: "Operational",
      badgeColor: "text-[#2563eb] bg-[#2563eb]/10 border-[#2563eb]/20",
    },
    {
      id: "customer_experience",
      name: "Customer Experience",
      legacyName: "Firestore Sync",
      status: "Operational",
      badge: "Healthy",
      badgeColor: "text-[#2563eb] bg-[#2563eb]/10 border-[#2563eb]/20",
    },
    {
      id: "file_management",
      name: "File Management",
      legacyName: "Storage (B2)",
      status: "Available",
      badge: "Healthy",
      badgeColor: "text-[#2563eb] bg-[#2563eb]/10 border-[#2563eb]/20",
    },
    {
      id: "payments",
      name: "Payments",
      legacyName: "Payment Gateway",
      status: "Operational",
      badge: "Available",
      badgeColor: "text-[#2563eb] bg-[#2563eb]/10 border-[#2563eb]/20",
    },
  ],
};
