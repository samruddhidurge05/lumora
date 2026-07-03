import React from 'react';

export default function Card({ children, className = '', style = {}, onClick }) {
  return (
    <div
      className={`glass-card ${className}`}
      style={{ padding: '24px', ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
