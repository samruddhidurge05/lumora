import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserOrders } from '../services/orderService';

export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    getUserOrders(user.uid)
      .then(setOrders)
      .catch(err => {
        console.error('[useOrders] Failed to load orders:', err);
        setError(err.message || "Failed to load orders");
      })
      .finally(() => setLoading(false));
  }, [user]);

  return { orders, loading, error };
}
