/**
 * ecosystemService.js
 * -------------------
 * Central orchestrator: called once after a successful purchase.
 * Propagates the event to every module that cares:
 *   - Customer: purchases, downloads, notifications
 *   - Vendor:   orders collection (read by useVendorData hooks via FastAPI + Firestore)
 *   - Affiliate: conversions (via affiliateService)
 *
 * IMPORTANT: All calls are fire-and-forget wrapped in try/catch so a
 * failure in any one module NEVER breaks the purchase success flow.
 */

import { db } from '../firebase';
import {
  collection, addDoc, doc, getDocs, query, where
} from 'firebase/firestore';
import { recordPurchase } from './purchaseService';
import { recordDownload } from './downloadsService';
import { createNotification } from './notificationService';
import { backendFetch } from '../utils/api';

// ── helpers ──────────────────────────────────────────────────────────────────

const safeRun = async (label, fn) => {
  try {
    await fn();
  } catch (err) {
    console.warn(`[ecosystemService] ${label} failed (non-fatal):`, err?.message || err);
  }
};

const INR_RATE = 80; // 1 USD = 80 INR

// ── main export ──────────────────────────────────────────────────────────────

/**
 * onPurchaseComplete
 * ------------------
 * Call this immediately after payment succeeds.
 *
 * @param {string}   uid          - Firebase uid of the purchasing customer
 * @param {Object[]} items        - Cart / buyNow items (each has: id, title, price, preview, category, seller)
 * @param {number}   totalUSD     - Order total in USD
 * @param {string}   [affCode]    - Affiliate referral code (from sessionStorage or URL)
 */
export const onPurchaseComplete = async (uid, items, totalUSD, affCode) => {
  if (!uid || !items || items.length === 0) return;

  const now      = new Date().toISOString();
  const orderId  = `ORD-${Date.now()}`;
  const totalINR = Math.round(totalUSD * INR_RATE);

  // ── 1. Write the order document (Vendor/Orders reads via FastAPI; Firestore is the truth layer)
  await safeRun('write order', async () => {
    await addDoc(collection(db, 'orders'), {
      orderId,
      customerId:   uid,
      items: items.map(item => ({
        productId:   String(item.id),
        productName: item.title || 'Product',
        preview:     item.preview || '',
        vendorId:    item.seller?.id || item.vendor_id || '',
        price:       item.price || 0,
        snapshot:    { title: item.title, price: item.price, preview: item.preview || item.thumbnail || item.image_urls?.[0] || null },
      })),
      totalUSD,
      totalINR,
      status:        'completed',
      paymentMethod: 'upi',
      created_at:    now,
    });
  });

  // ── 2. Record purchase + download for every item
  for (const item of items) {
    // Prefer file_url/fileUrl — all are set by enrichRawProducts() spread.
    // Do NOT fall back to a placeholder Firebase Storage URL; that would record a wrong file
    // in the downloads collection. Use null instead — Downloads.jsx fetches the real URL
    // fresh from the backend /products/{id}/download endpoint at download time.
    const fileUrl = item.fileUrl || item.file_url || null;

    await safeRun(`recordPurchase(${item.id})`, () =>
      recordPurchase(uid, String(item.id))
    );

    await safeRun(`recordDownload(${item.id})`, () =>
      recordDownload(uid, String(item.id), fileUrl)
    );

    // ── 3. Write a vendor notification (new order alert)
    await safeRun(`vendorNotif(${item.id})`, async () => {
      const vendorId = item.seller?.id || item.vendor_id;
      if (!vendorId) return;

      await addDoc(collection(db, 'vendorNotifications'), {
        vendorId,
        type:      'new_order',
        title:     'New Order Received',
        message:   `Your product "${item.title}" was purchased. Order ID: ${orderId}`,
        orderId,
        productId: String(item.id),
        read:      false,
        createdAt: now,
      });
    });
  }

  // ── 4. Send customer purchase notification (Firestore → Customer/Notifications)
  await safeRun('customerNotification', () =>
    createNotification(
      uid,
      '🎉 Purchase Successful',
      `You now own ${items.length} product${items.length > 1 ? 's' : ''}. Visit Downloads to access your files.`,
      'purchase'
    )
  );

  // ── 5. Affiliate commissions (if customer arrived via referral link)
  if (affCode) {
    await safeRun('affiliateCommissions', () =>
      backendFetch('/api/affiliate/commissions', {
        method: 'POST',
        body: JSON.stringify({
          affiliate_code: affCode,
          order_id:       orderId,
          customer_id:    uid,
          items:          items.map(item => ({
            productId: String(item.id),
            vendorId:  item.seller?.id || item.vendor_id || '',
          })),
        }),
      })
    );

    // ── 5b. Admin referral link conversion tracking
    await safeRun('adminReferralConversion', async () => {
      const refLinksSnap = await getDocs(
        query(collection(db, 'adminReferralLinks'), where('code', '==', affCode))
      );
      if (!refLinksSnap.empty) {
        const campaignId = refLinksSnap.docs[0].id;
        await addDoc(collection(db, 'adminAffiliateOrders'), {
          campaignId,
          code:        affCode,
          orderId,
          customerId:  uid,
          totalAmount: totalUSD,
          createdAt:   now,
        });
      }
    });
  }

  // ── 6. Clear the stored affiliate referral code after use
  sessionStorage.removeItem('lumora_aff_ref');
};
