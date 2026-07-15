import { getProductsApi, getProductApi, createProductApi, updateProductApi, deleteProductApi } from '../api/productApi';

export const getProducts = async () => {
  try {
    return await getProductsApi();
  } catch (error) {
    console.error('[productService] Error fetching products:', error);
    return [];
  }
};

export const getProductById = async (productId) => {
  try {
    return await getProductApi(productId);
  } catch (error) {
    console.error('[productService] Error fetching product:', error);
    return null;
  }
};

export const addProduct = async (productData) => {
  try {
    const res = await createProductApi(productData);
    return res.id;
  } catch (error) {
    console.error('[productService] Error adding product:', error);
    throw error;
  }
};

export const updateProduct = async (productId, updateData) => {
  try {
    return await updateProductApi(productId, updateData);
  } catch (error) {
    console.error('[productService] Error updating product:', error);
    throw error;
  }
};

export const deleteProduct = async (productId) => {
  try {
    await deleteProductApi(productId);
  } catch (error) {
    console.error('[productService] Error deleting product:', error);
    throw error;
  }
};

export const getProductsByCategory = async (category) => {
  try {
    const all = await getProductsApi();
    if (category && category !== 'All') {
      return all.filter(p => p.category === category);
    }
    return all;
  } catch (error) {
    console.error('[productService] Error fetching products by category:', error);
    return [];
  }
};

export const mapDocToProduct = (docSnap) => {
  if (!docSnap || typeof docSnap.data !== 'function' || !docSnap.exists()) {
    // Handle plain javascript object case if passed direct data
    const data = docSnap || {};
    return {
      id: data.id || data.uid || '',
      name: data.name || data.title || 'Untitled Product',
      title: data.title || data.name || 'Untitled Product',
      price: data.price || 0,
      discountPrice: data.discountPrice || null,
      category: data.category || 'General',
      thumbnail: data.thumbnail || data.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
      gallery: data.gallery || [],
      isFeatured: data.isFeatured || data.featured || false,
      status: data.status || 'Draft',
      videoUrl: data.videoUrl || null,
      creatorName: data.creatorName || data.vendorName || 'Creator',
      creatorAvatar: data.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
      shortDesc: data.shortDesc || data.short_desc || data.description || 'Premium digital assets',
      short_desc: data.short_desc || data.shortDesc || '',
      description: data.description || '',
      tags: data.tags || [],
      highlights: Array.isArray(data.highlights) ? data.highlights : [],
      features: Array.isArray(data.features) ? data.features : Array.isArray(data.highlights) ? data.highlights : [],
      what_you_get: Array.isArray(data.what_you_get) ? data.what_you_get : Array.isArray(data.whatYouGet) ? data.whatYouGet : [],
      whatYouGet: Array.isArray(data.whatYouGet) ? data.whatYouGet : Array.isArray(data.what_you_get) ? data.what_you_get : [],
      system_requirements: Array.isArray(data.system_requirements) ? data.system_requirements : Array.isArray(data.systemRequirements) ? data.systemRequirements : [],
      systemRequirements: Array.isArray(data.systemRequirements) ? data.systemRequirements : Array.isArray(data.system_requirements) ? data.system_requirements : [],
      installation_guide: data.installation_guide || data.installationGuide || '',
      installationGuide: data.installationGuide || data.installation_guide || '',
      downloads: data.downloads || 0,
      revenue: data.revenue || 0,
      createdAt: data.createdAt || null,
      pcloud_download_link: data.pcloud_download_link || data.pcloudDownloadLink || null,
      pcloudDownloadLink: data.pcloudDownloadLink || data.pcloud_download_link || null
    };
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    name: data.name || data.title || 'Untitled Product',
    title: data.title || data.name || 'Untitled Product',
    price: data.price || 0,
    discountPrice: data.discountPrice || null,
    category: data.category || 'General',
    thumbnail: data.thumbnail || data.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
    gallery: data.gallery || [],
    isFeatured: data.isFeatured || data.featured || false,
    status: data.status || 'Draft',
    videoUrl: data.videoUrl || null,
    creatorName: data.creatorName || data.vendorName || 'Creator',
    creatorAvatar: data.creatorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    shortDesc: data.shortDesc || data.short_desc || data.description || 'Premium digital assets',
    short_desc: data.short_desc || data.shortDesc || '',
    description: data.description || '',
    tags: data.tags || [],
    highlights: Array.isArray(data.highlights) ? data.highlights : [],
    features: Array.isArray(data.features) ? data.features : Array.isArray(data.highlights) ? data.highlights : [],
    what_you_get: Array.isArray(data.what_you_get) ? data.what_you_get : Array.isArray(data.whatYouGet) ? data.whatYouGet : [],
    whatYouGet: Array.isArray(data.whatYouGet) ? data.whatYouGet : Array.isArray(data.what_you_get) ? data.what_you_get : [],
    system_requirements: Array.isArray(data.system_requirements) ? data.system_requirements : Array.isArray(data.systemRequirements) ? data.systemRequirements : [],
    systemRequirements: Array.isArray(data.systemRequirements) ? data.systemRequirements : Array.isArray(data.system_requirements) ? data.system_requirements : [],
    installation_guide: data.installation_guide || data.installationGuide || '',
    installationGuide: data.installationGuide || data.installation_guide || '',
    downloads: data.downloads || 0,
    revenue: data.revenue || 0,
    createdAt: data.createdAt || null,
    pcloud_download_link: data.pcloud_download_link || data.pcloudDownloadLink || null,
    pcloudDownloadLink: data.pcloudDownloadLink || data.pcloud_download_link || null
  };
};

export const productService = {
  create: addProduct,
  update: updateProduct,
  remove: deleteProduct,
  get: getProductById,
  getAll: getProducts
};


