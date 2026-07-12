import React, { createContext, useContext, useState, useEffect } from 'react';

const AffiliateCartContext = createContext(null);

const STORAGE_KEY = 'lumora_aff_cart';

export function AffiliateCartProvider({ children }) {
  const [affCart, setAffCart] = useState([]);
  const [isAffCartOpen, setIsAffCartOpen] = useState(false);

  const addToAffCart = (product) => {
    setAffCart(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsAffCartOpen(true);
  };

  const removeFromAffCart = (id) => {
    setAffCart(prev => prev.filter(item => item.id !== id));
  };

  const updateAffQuantity = (id, quantity) => {
    if (quantity <= 0) {
      removeFromAffCart(id);
      return;
    }
    setAffCart(prev =>
      prev.map(item => item.id === id ? { ...item, quantity } : item)
    );
  };

  const clearAffCart = () => setAffCart([]);

  const affCartTotal = affCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const affCartCount = affCart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AffiliateCartContext.Provider value={{
      affCart,
      isAffCartOpen,
      setIsAffCartOpen,
      addToAffCart,
      removeFromAffCart,
      updateAffQuantity,
      clearAffCart,
      affCartTotal,
      affCartCount,
    }}>
      {children}
    </AffiliateCartContext.Provider>
  );
}

export function useAffiliateCart() {
  const ctx = useContext(AffiliateCartContext);
  if (!ctx) throw new Error('useAffiliateCart must be used within AffiliateCartProvider');
  return ctx;
}
