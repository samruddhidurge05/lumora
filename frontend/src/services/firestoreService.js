import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  deleteDoc, query, where, orderBy, limit, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// ── Generic CRUD helpers ──────────────────────────────────────────

export const getDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error(`[firestoreService] getDocument error (${collectionName}/${docId}):`, error);
    return null;
  }
};

export const getCollection = async (collectionName) => {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error(`[firestoreService] getCollection error (${collectionName}):`, error);
    return [];
  }
};

export const createDocument = async (collectionName, data, docId = null) => {
  try {
    const payload = { ...data, created_at: new Date().toISOString() };
    if (docId) {
      await setDoc(doc(db, collectionName, docId), payload);
      return docId;
    } else {
      const docRef = await addDoc(collection(db, collectionName), payload);
      return docRef.id;
    }
  } catch (error) {
    console.error(`[firestoreService] createDocument error (${collectionName}):`, error);
    throw error;
  }
};

export const updateDocument = async (collectionName, docId, data) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, { ...data, updated_at: new Date().toISOString() });
  } catch (error) {
    console.error(`[firestoreService] updateDocument error (${collectionName}/${docId}):`, error);
    throw error;
  }
};

export const deleteDocument = async (collectionName, docId) => {
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    console.error(`[firestoreService] deleteDocument error (${collectionName}/${docId}):`, error);
    throw error;
  }
};

export const queryDocuments = async (collectionName, conditions = [], orderByField = null, limitCount = null) => {
  try {
    let q = collection(db, collectionName);
    const constraints = conditions.map(([field, operator, value]) => where(field, operator, value));
    if (orderByField) constraints.push(orderBy(orderByField));
    if (limitCount) constraints.push(limit(limitCount));
    const querySnapshot = await getDocs(query(q, ...constraints));
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error(`[firestoreService] queryDocuments error (${collectionName}):`, error);
    return [];
  }
};
