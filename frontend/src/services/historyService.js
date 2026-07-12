import { collection, getDocs, doc, query, where, deleteDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { backendFetch } from "../utils/api";

let memoryRecentlyViewed = [];

// Get local history
export const getLocalRecentlyViewed = () => {
  return memoryRecentlyViewed;
};

// Clear local & Firestore/backend history
export const clearRecentlyViewedHistory = async (userId) => {
  memoryRecentlyViewed = [];

  // Try backend first
  try {
    await backendFetch(`/history/`, { method: "DELETE" });
    return;
  } catch (backendError) {
    console.warn("[historyService] FastAPI backend failed, using Firebase:", backendError.message);
  }

  if (userId) {
    try {
      const q = query(
        collection(db, "recently_viewed"),
        where("userId", "==", userId)
      );
      const snap = await getDocs(q);
      const promises = snap.docs.map(d => deleteDoc(doc(db, "recently_viewed", d.id)));
      await Promise.all(promises);
    } catch (error) {
      console.error("[historyService] Error clearing Firestore history:", error);
    }
  }
};

// Track a new product view
export const trackProductViewing = async (userId, product) => {
  if (!product) return;

  // 1. Update memory always (instant, reliable)
  let localList = getLocalRecentlyViewed();
  localList = [product, ...localList.filter(p => p.id !== product.id)].slice(0, 10);
  memoryRecentlyViewed = localList;

  // 2. Try backend
  try {
    const backendUid = localStorage.getItem('lumora_backend_uid');
    if (backendUid) {
      await backendFetch(`/history/`, {
        method: "POST",
        body: JSON.stringify({
          user_id: parseInt(backendUid, 10),
          product_id: product.id
        })
      });
      return;
    }
  } catch (backendError) {
    // Non-fatal, continue to Firebase
    console.warn("[historyService] FastAPI backend failed, using Firebase:", backendError.message);
  }

  // 3. Firebase fallback
  if (userId) {
    try {
      const docId = `${userId}_${product.id}`;
      await setDoc(doc(db, "recently_viewed", docId), {
        userId,
        productId: product.id,
        productTitle: product.title,
        productCategory: product.category,
        productPrice: product.price,
        productPreview: product.preview,
        viewed_at: new Date().toISOString()
      });
    } catch (error) {
      console.error("[historyService] Error tracking view in Firestore:", error);
    }
  }
};

// Fetch from backend or Firestore
export const fetchRecentlyViewed = async (userId) => {
  // Try backend first
  try {
    const data = await backendFetch(`/history/`);
    if (data && data.length > 0) {
      return data.map(item => ({
        id: item.product_id,
        productId: item.product_id,
        viewed_at: item.viewed_at
      }));
    }
  } catch (backendError) {
    console.warn("[historyService] FastAPI backend failed, using Firebase:", backendError.message);
  }

  // Firebase fallback
  if (!userId) return getLocalRecentlyViewed();
  try {
    const q = query(
      collection(db, "recently_viewed"),
      where("userId", "==", userId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map(doc => ({
      id: doc.data().productId,
      title: doc.data().productTitle,
      category: doc.data().productCategory,
      price: doc.data().productPrice,
      preview: doc.data().productPreview,
      viewed_at: doc.data().viewed_at
    }));
    return list.sort((a, b) => new Date(b.viewed_at) - new Date(a.viewed_at));
  } catch (error) {
    console.error("[historyService] Error fetching history from Firestore:", error);
    return getLocalRecentlyViewed();
  }
};
