import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import products from "../data/products.json";

const uploadProducts = async () => {
  try {
    for (const product of products) {
      await addDoc(collection(db, "products"), product);
    }

    console.log("Products uploaded successfully!");
  } catch (error) {
    console.error(error);
  }
};

uploadProducts();