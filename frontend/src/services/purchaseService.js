import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

// Purchase recording is handled by the backend — no direct Firestore write here
export const recordPurchase = async (userId, productId) => {
  try {
    // Purchase is recorded via the backend API; nothing to write directly here
    return null;
  } catch (error) {
    console.error("[purchaseService] Error recording purchase:", error);
    throw error;
  }
};

// Get all purchased product IDs for a user
export const getUserPurchases = async (userId) => {
  try {
    const q = query(collection(db, "purchases"), where("userId", "==", userId), where("accessStatus", "==", "active"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data().productId);
  } catch (error) {
    console.error("[purchaseService] Error fetching user purchases:", error);
    return [];
  }
};
