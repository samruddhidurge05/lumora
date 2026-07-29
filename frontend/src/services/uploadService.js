import { uploadFile } from './storageService';

export const uploadProductFile = async (file, productId, onProgress) => {
  return uploadFile(file, 'file', onProgress);
};

export const uploadProductImage = async (file, productId, onProgress) => {
  return uploadFile(file, 'image', onProgress);
};

export const uploadAvatar = async (file, userId, onProgress) => {
  return uploadFile(file, 'image', onProgress);
};
