import { getWishlistApi, addToWishlistApi, removeFromWishlistApi } from '../api/wishlistApi';

export const addToWishlist = async (userId, productId) => {
  try {
    await addToWishlistApi(productId);
  } catch (error) {
    console.error("[wishlistService] Error adding to wishlist:", error);
    throw error;
  }
};

export const removeFromWishlist = async (userId, productId) => {
  try {
    await removeFromWishlistApi(productId);
  } catch (error) {
    console.error("[wishlistService] Error removing from wishlist:", error);
    throw error;
  }
};

export const getUserWishlist = async (userId) => {
  try {
    return await getWishlistApi();
  } catch (error) {
    console.error("[wishlistService] Error fetching user wishlist:", error);
    return [];
  }
};
