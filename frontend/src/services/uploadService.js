import { uploadFile } from './storageService';

export const uploadProductFile = async (file, productId, onProgress) => {
  const path = `products/${productId}/${Date.now()}_${file.name}`;
  return uploadFile(file, path, onProgress);
};

export const uploadProductImage = async (file, productId, onProgress) => {
  const path = `product-images/${productId}/${Date.now()}_${file.name}`;
  return uploadFile(file, path, onProgress);
};

export const uploadAvatar = async (file, userId, onProgress) => {
  const path = `avatars/${userId}/${Date.now()}_${file.name}`;
  return uploadFile(file, path, onProgress);
};
