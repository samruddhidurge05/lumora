import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

// Add a purchase record in Firestore
export const recordPurchase = async (userId, productId) => {
  try {
    const purchasesRef = collection(db, "purchases");
    const docRef = await addDoc(purchasesRef, {
      userId,
      productId,
      purchaseDate: new Date().toISOString(),
      accessStatus: "active"
    });
    return docRef.id;
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
