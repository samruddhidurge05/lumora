import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { backendFetch } from "../utils/api";

// Get all versions for a specific product
export const getProductVersions = async (productId) => {
  try {
    const data = await backendFetch(`/versions/${productId}`);
    if (data) {
      // Map keys if needed (FastAPI models use snake_case)
      return data.map(item => ({
        id: item.id,
        productId: item.product_id,
        version_number: item.version_number,
        changelog: item.changelog,
        is_major: item.is_major,
        file_url: item.file_url,
        created_at: item.created_at
      }));
    }
  } catch (backendError) {
    console.warn("[versionService] FastAPI backend failed, falling back to Firebase:", backendError.message);
  }

  try {
    const q = query(
      collection(db, "product_versions"),
      where("productId", "==", productId)
    );
    const querySnapshot = await getDocs(q);
    const list = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    // Sort descending by date
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch (error) {
    console.error("[versionService] Error fetching product versions from Firebase:", error);
    return [];
  }
};

// Create a new version for a product
export const addProductVersion = async (productId, versionNumber, changelog, isMajor, fileUrl) => {
  const versionData = {
    product_id: productId,
    version_number: versionNumber,
    changelog,
    is_major: isMajor,
    file_url: fileUrl || "https://firebasestorage.googleapis.com/v0/b/lumora-e6ddc.firebasestorage.app/o/products%2Fplaceholder.zip?alt=media"
  };

  try {
    const res = await backendFetch(`/versions/`, {
      method: "POST",
      body: JSON.stringify(versionData)
    });
    if (res) return res.id;
  } catch (backendError) {
    console.warn("[versionService] FastAPI backend failed, falling back to Firebase:", backendError.message);
  }

  try {
    const docRef = await addDoc(collection(db, "product_versions"), {
      productId,
      version_number: versionNumber,
      changelog,
      is_major: isMajor,
      file_url: versionData.file_url,
      created_at: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("[versionService] Error creating product version in Firebase:", error);
    throw error;
  }
};
