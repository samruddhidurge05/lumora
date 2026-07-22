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
    // Return the full ProductResponse object so callers can read all fields
    // (title, price, thumbnail, features, etc.) to immediately update local UI state.
    const res = await createProductApi(productData);
    return res;
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
    const imageUrlsList = Array.isArray(data.image_urls) ? data.image_urls
                        : Array.isArray(data.previewImages) ? data.previewImages
                        : [];
    return {
      id: data.id || data.uid || '',
      name: data.name || data.title || 'Untitled Product',
      title: data.title || data.name || 'Untitled Product',
      price: data.price != null ? parseFloat(data.price) : 0,
      discountPrice: data.discountPrice || null,
      category: data.category || 'General',
      thumbnail: (data.thumbnail && !data.thumbnail.includes('unsplash.com'))
        ? data.thumbnail
        : (imageUrlsList[0] || data.thumbnail || null),
      preview: (data.preview && !data.preview.includes('unsplash.com'))
        ? data.preview
        : (imageUrlsList[0] || data.preview || null),
      image_urls: imageUrlsList,
      previewImages: imageUrlsList,
      gallery: data.gallery || imageUrlsList,
      isFeatured: data.isFeatured || data.featured || false,
      status: data.status || 'Draft',
      videoUrl: data.videoUrl || null,
      creatorName: data.creatorName || data.vendorName || 'Creator',
      // Do NOT fall back to a hardcoded Unsplash URL — the backend already filters
      // Unsplash URLs out of creatorAvatar (Defect 5 fix). Keeping null here
      // lets the UI display a neutral default without re-injecting the placeholder.
      creatorAvatar: data.creatorAvatar || null,
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
      version: data.version || 'v1.0.0',
      license: data.license || null,
      subcategory: data.subcategory || '',
      discount: data.discount || 0,
      visibility: data.visibility || 'public',
    };
  }

  const data = docSnap.data();
  const imageUrlsList = Array.isArray(data.image_urls) ? data.image_urls
                      : Array.isArray(data.previewImages) ? data.previewImages
                      : [];
  return {
    id: docSnap.id,
    name: data.name || data.title || 'Untitled Product',
    title: data.title || data.name || 'Untitled Product',
    price: data.price != null ? parseFloat(data.price) : 0,
    discountPrice: data.discountPrice || null,
    category: data.category || 'General',
    thumbnail: (data.thumbnail && !data.thumbnail.includes('unsplash.com'))
      ? data.thumbnail
      : (imageUrlsList[0] || data.thumbnail || null),
    preview: (data.preview && !data.preview.includes('unsplash.com'))
      ? data.preview
      : (imageUrlsList[0] || data.preview || null),
    image_urls: imageUrlsList,
    previewImages: imageUrlsList,
    gallery: data.gallery || imageUrlsList,
    isFeatured: data.isFeatured || data.featured || false,
    status: data.status || 'Draft',
    videoUrl: data.videoUrl || null,
    creatorName: data.creatorName || data.vendorName || 'Creator',
    // Do NOT fall back to a hardcoded Unsplash URL — backend Defect 5 fix writes null
    // when no real avatar is available. Re-injecting Unsplash here would undo that fix.
    creatorAvatar: data.creatorAvatar || null,
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
    version: data.version || 'v1.0.0',
    license: data.license || null,
    subcategory: data.subcategory || '',
    discount: data.discount || 0,
    visibility: data.visibility || 'public',
  };
};

export const productService = {
  create: addProduct,
  update: updateProduct,
  remove: deleteProduct,
  get: getProductById,
  getAll: getProducts
};


