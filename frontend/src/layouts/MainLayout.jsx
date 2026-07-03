import React from 'react';

export default function MainLayout({ children }) {
  return (
    <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh' }}>
      {children}
    </div>
  );
}
