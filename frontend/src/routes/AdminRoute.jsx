import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export default function AdminRoute({ children }) {
  const { user, loading, userRole } = useAuth();
  const { navigateTo } = useApp();

  if (loading) return null;
  if (!user || userRole !== 'admin') { navigateTo('landing'); return null; }
  return children;
}
