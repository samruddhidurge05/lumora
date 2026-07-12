import { collection, addDoc, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { backendFetch } from "../utils/api";

// Get user alerts/notifications sorted by creation date (newest first)
export const getUserNotifications = async (userId) => {
  // Try backend first
  try {
    const data = await backendFetch(`/notifications/`);
    if (data) {
      return data.map(n => ({
        id: String(n.id),
        userId: String(n.user_id),
        title: n.title,
        message: n.message,
        category: n.category,
        isRead: n.is_read,
        created_at: n.created_at
      })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  } catch (backendError) {
    console.warn("[notificationService] FastAPI backend failed, using Firebase:", backendError.message);
  }

  // Firebase fallback
  try {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    );
    const querySnapshot = await getDocs(q);
    const list = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch (error) {
    console.error("[notificationService] Error fetching notifications:", error);
    return [];
  }
};

// Create a new notification alert
export const createNotification = async (userId, title, message, category = "general") => {
  // Try backend first
  try {
    const backendUid = localStorage.getItem('lumora_backend_uid');
    if (backendUid) {
      const res = await backendFetch(`/notifications/`, {
        method: "POST",
        body: JSON.stringify({
          user_id: parseInt(backendUid, 10),
          title,
          message,
          category
        })
      });
      if (res) return res.id;
    }
  } catch (backendError) {
    console.warn("[notificationService] FastAPI backend failed, using Firebase:", backendError.message);
  }

  // Firebase fallback
  try {
    const docRef = await addDoc(collection(db, "notifications"), {
      userId,
      title,
      message,
      category,
      isRead: false,
      created_at: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("[notificationService] Error creating notification:", error);
    throw error;
  }
};

// Mark notification as read
export const markNotificationAsRead = async (notificationId) => {
  // Try backend first
  try {
    await backendFetch(`/notifications/${notificationId}/read`, { method: "PUT" });
    return;
  } catch (backendError) {
    console.warn("[notificationService] FastAPI backend failed, using Firebase:", backendError.message);
  }

  // Firebase fallback
  try {
    const docRef = doc(db, "notifications", notificationId);
    await updateDoc(docRef, { isRead: true });
  } catch (error) {
    console.error(`[notificationService] Error marking notification ${notificationId} as read:`, error);
    throw error;
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (userId) => {
  try {
    await backendFetch(`/notifications/mark-all-read`, { method: "POST" });
    return;
  } catch (backendError) {
    console.warn("[notificationService] FastAPI backend failed, using Firebase:", backendError.message);
  }

  try {
    const q = query(collection(db, "notifications"), where("userId", "==", userId));
    const snap = await getDocs(q);
    const promises = snap.docs.map(d => updateDoc(doc(db, "notifications", d.id), { isRead: true }));
    await Promise.all(promises);
  } catch (error) {
    console.error("[notificationService] Error marking all as read:", error);
  }
};
