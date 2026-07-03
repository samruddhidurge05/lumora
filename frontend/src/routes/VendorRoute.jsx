import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

export default function VendorRoute({ children }) {
  const { user, loading } = useAuth();
  const { navigateTo } = useApp();

  if (loading) return null;
  if (!user) { navigateTo('login-selection'); return null; }
  return children;
}
