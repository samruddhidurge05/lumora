import { useApp } from '../context/AppContext';

export function useCart() {
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, isCartOpen, setIsCartOpen } = useApp();
  return { cart, addToCart, removeFromCart, updateQuantity, clearCart, isCartOpen, setIsCartOpen };
}
