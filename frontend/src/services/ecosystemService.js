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
  collection, addDoc, doc, setDoc, getDoc, updateDoc
} from 'firebase/firestore';
import { recordPurchase } from './purchaseService';
import { recordDownload } from './downloadsService';
import { createNotification } from './notificationService';
import { affiliateService } from './affiliateService';

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
        snapshot:    { title: item.title, price: item.price, preview: item.preview },
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
    const fileUrl = item.fileUrl || item.file_url ||
      'https://firebasestorage.googleapis.com/v0/b/lumora-e6ddc.firebasestorage.app/o/products%2Fplaceholder.zip?alt=media';

    await safeRun(`recordPurchase(${item.id})`, () =>
      recordPurchase(uid, String(item.id))
    );

    await safeRun(`recordDownload(${item.id})`, () =>
      recordDownload(uid, String(item.id), fileUrl)
    );

    // ── 3. Update vendor product stats (increment sales + revenue counters)
    await safeRun(`vendorStats(${item.id})`, async () => {
      const vendorId = item.seller?.id || item.vendor_id;
      if (!vendorId) return;

      const statsRef  = doc(db, 'vendorStats', vendorId);
      const statsSnap = await getDoc(statsRef);
      const priceINR  = Math.round((item.price || 0) * INR_RATE);

      if (statsSnap.exists()) {
        const d = statsSnap.data();
        await updateDoc(statsRef, {
          totalRevenue: (d.totalRevenue || 0) + priceINR,
          totalSales:   (d.totalSales   || 0) + 1,
          updatedAt:    now,
        });
      } else {
        await setDoc(statsRef, {
          vendorId,
          totalRevenue: priceINR,
          totalSales:   1,
          createdAt:    now,
          updatedAt:    now,
        });
      }
    });

    // ── 4. Write a vendor notification (new order alert)
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

  // ── 5. Send customer purchase notification (Firestore → Customer/Notifications)
  await safeRun('customerNotification', () =>
    createNotification(
      uid,
      '🎉 Purchase Successful',
      `You now own ${items.length} product${items.length > 1 ? 's' : ''}. Visit Downloads to access your files.`,
      'purchase'
    )
  );

  // ── 6. Affiliate conversions (if customer arrived via referral link)
  if (affCode) {
    await safeRun('affiliateConversions', () =>
      affiliateService.createConversionsForOrder(
        {
          orderId,
          customerId: uid,
          items: items.map(item => ({
            productId: String(item.id),
            vendorId:  item.seller?.id || item.vendor_id || '',
            snapshot:  { title: item.title, price: item.price },
          })),
        },
        { affiliateCode: affCode }
      )
    );
  }

  // ── 7. Clear the stored affiliate referral code after use
  sessionStorage.removeItem('lumora_aff_ref');

  console.log('[ecosystemService] Purchase propagation complete for order:', orderId);
};
