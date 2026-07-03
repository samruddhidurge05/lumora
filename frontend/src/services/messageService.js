import { collection, addDoc, getDocs, doc, updateDoc, query, where, limit, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// Get user conversations (where user is either buyer or seller)
export const getUserConversations = async (userId) => {
  try {
    const q1 = query(collection(db, "conversations"), where("buyer_id", "==", userId));
    const q2 = query(collection(db, "conversations"), where("seller_id", "==", userId));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const conversations = [];

    snap1.docs.forEach(doc => conversations.push({ id: doc.id, ...doc.data() }));
    snap2.docs.forEach(doc => {
      // Avoid duplicates just in case
      if (!conversations.some(c => c.id === doc.id)) {
        conversations.push({ id: doc.id, ...doc.data() });
      }
    });

    // Sort by updated_at desc
    return conversations.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  } catch (error) {
    console.error("[messageService] Error fetching conversations:", error);
    return [];
  }
};

// Get messages for a conversation
export const getConversationMessages = async (conversationId) => {
  try {
    const q = query(
      collection(db, `conversations/${conversationId}/messages`)
    );
    const querySnapshot = await getDocs(q);
    const list = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } catch (error) {
    console.error("[messageService] Error fetching messages:", error);
    return [];
  }
};

// Create a new conversation or return existing
export const createConversation = async (buyerId, buyerName, sellerId, sellerName) => {
  try {
    // Check if conversation already exists between buyer and seller
    const q = query(
      collection(db, "conversations"),
      where("buyer_id", "==", buyerId),
      where("seller_id", "==", sellerId)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].id;
    }

    // Otherwise create new
    const docRef = await addDoc(collection(db, "conversations"), {
      buyer_id: buyerId,
      buyer_name: buyerName,
      seller_id: sellerId,
      seller_name: sellerName,
      last_message: "",
      unread_buyer: 0,
      unread_seller: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("[messageService] Error creating conversation:", error);
    throw error;
  }
};

// Send message
export const sendMessage = async (conversationId, senderId, senderRole, content, attachmentUrl = null) => {
  try {
    const now = new Date().toISOString();
    // Add message doc
    const msgRef = await addDoc(collection(db, `conversations/${conversationId}/messages`), {
      sender_id: senderId,
      content,
      attachment_url: attachmentUrl,
      is_read: false,
      created_at: now
    });

    // Update conversation last message
    const convRef = doc(db, "conversations", conversationId);
    
    // Fetch current conversation to update unread counts
    const convSnap = await getDocs(query(collection(db, "conversations"))); // simple fallback
    // We update conversation doc
    const isBuyer = senderRole === "customer";
    
    await updateDoc(convRef, {
      last_message: content,
      updated_at: now,
      // If buyer sent it, increment unread_seller, else increment unread_buyer
      ...(isBuyer ? { unread_seller: 1 } : { unread_buyer: 1 })
    });

    return msgRef.id;
  } catch (error) {
    console.error("[messageService] Error sending message:", error);
    throw error;
  }
};

// Clear unread badge
export const markMessagesAsRead = async (conversationId, role) => {
  try {
    const convRef = doc(db, "conversations", conversationId);
    if (role === "customer") {
      await updateDoc(convRef, { unread_buyer: 0 });
    } else {
      await updateDoc(convRef, { unread_seller: 0 });
    }
  } catch (error) {
    console.error("[messageService] Error marking messages as read:", error);
  }
};
