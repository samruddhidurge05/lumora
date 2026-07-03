import { doc, getDoc, setDoc, getDocs, collection, query, where } from "firebase/firestore";
import { db } from "../firebase";

// Record or increment a file download event in Firestore
export const recordDownload = async (userId, productId, fileUrl) => {
  try {
    const docId = `${userId}_${productId}`;
    const docRef = doc(db, "downloads", docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const currentCount = docSnap.data().downloadCount || 0;
      await setDoc(docRef, {
        userId,
        productId,
        file_url: fileUrl,
        downloadCount: currentCount + 1,
        downloadedAt: new Date().toISOString()
      }, { merge: true });
    } else {
      await setDoc(docRef, {
        userId,
        productId,
        file_url: fileUrl,
        downloadCount: 1,
        downloadedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    
    console.error("[downloadsService] Error recording download event:", error);
    throw error;
  }
};

// Get download stats for a user
export const getUserDownloads = async (userId) => {
  try {
    const q = query(collection(db, "downloads"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error("[downloadsService] Error fetching user downloads:", error);
    return [];
  }
};
