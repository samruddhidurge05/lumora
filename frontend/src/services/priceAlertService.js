import { collection, getDocs, doc, updateDoc, query, where, deleteDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { backendFetch } from "../utils/api";
import { createNotification } from "./notificationService";

// Fetch price alerts for user
export const getPriceAlerts = async (userId) => {
  // Try backend first
  try {
    const data = await backendFetch(`/price-alerts/`);
    if (data) {
      return data.map(a => ({
        id: String(a.id),
        userId: String(a.user_id),
        productId: a.product_id,
        originalPrice: a.original_price,
        targetPrice: a.target_price,
        active: a.active,
        createdAt: a.created_at
      }));
    }
  } catch (backendError) {
    console.warn("[priceAlertService] FastAPI backend failed, using Firebase:", backendError.message);
  }

  // Firebase fallback
  try {
    const q = query(
      collection(db, "price_alerts"),
      where("userId", "==", userId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("[priceAlertService] Error fetching price alerts:", error);
    return [];
  }
};

// Toggle or set price alert active state
export const togglePriceAlertSubscription = async (userId, product, active) => {
  // Try backend first
  try {
    const backendUid = localStorage.getItem('lumora_backend_uid');
    if (backendUid) {
      if (!active) {
        // Delete by querying alerts and deleting matching
        const alerts = await backendFetch(`/price-alerts/`);
        const existing = alerts.find(a => a.product_id === product.id);
        if (existing) {
          await backendFetch(`/price-alerts/${existing.id}`, { method: "DELETE" });
        }
      } else {
        await backendFetch(`/price-alerts/`, {
          method: "POST",
          body: JSON.stringify({
            user_id: parseInt(backendUid, 10),
            product_id: product.id,
            original_price: product.price,
            target_price: Math.round(product.price * 0.9 * 100) / 100,
            active: true
          })
        });
      }
      return;
    }
  } catch (backendError) {
    console.warn("[priceAlertService] FastAPI backend failed, using Firebase:", backendError.message);
  }

  // Firebase fallback
  try {
    const docId = `${userId}_${product.id}`;
    if (!active) {
      await deleteDoc(doc(db, "price_alerts", docId));
      return;
    }

    await setDoc(doc(db, "price_alerts", docId), {
      userId,
      productId: product.id,
      productTitle: product.title,
      productPreview: product.preview,
      originalPrice: product.price,
      targetPrice: Math.round(product.price * 0.9),
      active: true,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("[priceAlertService] Error toggling price alert:", error);
    throw error;
  }
};

// Check for price changes and notify subscribers (simulated backend triggers)
export const triggerPriceDropNotifications = async (product, newPrice) => {
  try {
    const oldPrice = product.price;
    if (newPrice >= oldPrice) return; // Not a price drop

    const discountPercent = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

    // Try backend trigger first
    try {
      await backendFetch(`/price-alerts/trigger?product_id=${encodeURIComponent(product.id)}&new_price=${newPrice}`, {
        method: "POST"
      });
      return;
    } catch (backendError) {
      console.warn("[priceAlertService] Backend trigger failed, using Firebase:", backendError.message);
    }

    // Firebase fallback
    const q = query(
      collection(db, "price_alerts"),
      where("productId", "==", product.id),
      where("active", "==", true)
    );
    const snap = await getDocs(q);

    const promises = snap.docs.map(async (alertDoc) => {
      const alert = alertDoc.data();
      const userId = alert.userId;

      const message = `Price Drop Alert! '${product.title}' has dropped from ₹${Math.round(oldPrice)} to ₹${Math.round(newPrice)} (${discountPercent}% OFF).`;
      await createNotification(userId, "Price Drop Alert! ✦", message, "price_drop");

      const alertRef = doc(db, "price_alerts", alertDoc.id);
      const historyItem = {
        oldPrice,
        newPrice,
        date: new Date().toISOString(),
        discount: `${discountPercent}% OFF`
      };

      const currentHistory = alert.history || [];
      await updateDoc(alertRef, {
        originalPrice: newPrice,
        history: [historyItem, ...currentHistory]
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error("[priceAlertService] Error triggering price drop alerts:", error);
  }
};

export default triggerPriceDropNotifications;
