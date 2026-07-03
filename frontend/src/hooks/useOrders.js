import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserOrders } from '../services/orderService';

export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getUserOrders(user.uid)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [user]);

  return { orders, loading };
}
