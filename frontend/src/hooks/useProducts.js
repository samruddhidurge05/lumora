import { useApp } from '../context/AppContext';

export function useProducts() {
  const { products, activeCategory, setActiveCategory, formatPrice } = useApp();
  return { products, activeCategory, setActiveCategory, formatPrice };
}
