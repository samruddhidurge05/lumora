import React from 'react';
import AuthBackground from '../components/AuthBackground';

export default function AuthLayout({ children }) {
  return <AuthBackground>{children}</AuthBackground>;
}
