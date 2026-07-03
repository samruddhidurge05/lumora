export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const isValidPhone = (phone) => /^[\+]?[0-9\s\-]{8,15}$/.test(phone);

export const isStrongPassword = (password) => password.length >= 8;

export const isValidUrl = (url) => {
  try { new URL(url); return true; } catch { return false; }
};

export const validateCheckoutForm = (form) => {
  const errors = {};
  if (!form.name?.trim()) errors.name = 'Name is required';
  if (!isValidEmail(form.email)) errors.email = 'Valid email is required';
  if (!form.phone?.trim()) errors.phone = 'Phone is required';
  if (!form.city?.trim()) errors.city = 'City is required';
  if (!form.state?.trim()) errors.state = 'State is required';
  if (!form.country?.trim()) errors.country = 'Country is required';
  return errors;
};
