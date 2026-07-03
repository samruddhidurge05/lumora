import { db } from "../firebase.js";
import products from "../data/products.json";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";

/**
 * Automatically seeds the products collection in Firestore.
 * Performs duplicate checking for each product based on its custom 'id' field.
 */
export async function uploadProducts() {
  console.log("%c[Firestore Seeder] Starting product upload process...", "color: #7c3aed; font-weight: bold;");
  
  let uploadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    const productsCollectionRef = collection(db, "products");

    for (const product of products) {
      if (!product.id) {
        console.warn(`%c[Firestore Seeder] Warning: Product is missing 'id' field, skipping.`, "color: #d97706;", product);
        skippedCount++;
        continue;
      }

      try {
        // 1. Firestore query logic to search for existing product with same custom id
        const q = query(productsCollectionRef, where("id", "==", product.id));
        const querySnapshot = await getDocs(q);

        // 2. Duplicate-checking logic: check if snapshot contains documents
        if (!querySnapshot.empty) {
          console.log(`%c[Firestore Seeder] Skip: Product "${product.title}" (ID: ${product.id}) already exists.`, "color: #6b7280;");
          skippedCount++;
        } else {
          // 3. Insert the product to Firestore using setDoc with custom id as the doc name
          const docRef = doc(db, "products", product.id);
          await setDoc(docRef, product);
          console.log(`%c[Firestore Seeder] Success: Uploaded "${product.title}" (ID: ${product.id})`, "color: #10b981;");
          uploadedCount++;
        }
      } catch (err) {
        console.error(`%c[Firestore Seeder] Error: Failed to process product "${product.title}" (ID: ${product.id})`, "color: #ef4444;", err);
        errorCount++;
      }
    }

    console.log(
      `%c[Firestore Seeder] Seeding Completed!
      ---------------------------------
      Total Products in JSON: ${products.length}
      Successfully Uploaded : ${uploadedCount}
      Skipped (Already Exist): ${skippedCount}
      Failed                : ${errorCount}
      ---------------------------------`,
      "color: #7c3aed; font-weight: bold;"
    );
  } catch (globalError) {
    console.error("%c[Firestore Seeder] Critical Error in seeder script:", "color: #ef4444; font-weight: bold;", globalError);
  }
}
