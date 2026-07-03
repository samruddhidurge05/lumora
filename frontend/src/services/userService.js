import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { backendFetch } from "../utils/api";

// Create or initialize user profile document in Firestore
export const createUserProfile = async (uid, profileData) => {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      const defaultData = {
        uid,
        name: profileData.name || "Lumora User",
        email: profileData.email,
        role: profileData.role || "customer",
        profileImage: profileData.profileImage || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        account_status: "active"
      };
      await setDoc(docRef, defaultData);
      return defaultData;
    }
    return docSnap.data();
  } catch (error) {
    console.error("[userService] Error creating user profile:", error);
    throw error;
  }
};

// Fetch user profile from Firestore
export const getUserProfile = async (uid) => {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error(`[userService] Error fetching user profile ${uid}:`, error);
    return null;
  }
};

// Update user profile fields (e.g. settings)
export const updateUserProfile = async (uid, updateData) => {
  try {
    if (updateData.name) {
      await backendFetch('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ name: updateData.name })
      }).catch(() => null);
    }
  } catch (backendError) {
    console.warn('[userService] Backend profile update notice:', backendError);
  }

  try {
    const docRef = doc(db, "users", uid);
    await updateDoc(docRef, {
      ...updateData,
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[userService] Error updating user profile ${uid}:`, error);
  }
};

