import React from 'react';
import AdminSidebar from './AdminSidebar';
import '../styles/admin.css';

export default function AdminLayout({ activePage, children }) {
  return (
    <div className="min-h-screen relative font-sans text-[#2D004D] bg-[#FFFDF9] overflow-x-hidden selection:bg-[#D8BFE3] selection:text-[#2D004D]">
      
      <div className="admin-layout-grid">
        {/* Left Column: Glassmorphism Sidebar */}
        <AdminSidebar activePage={activePage} />

        {/* Right Column: Main Content */}
        <div className="admin-main-content">
          {children}
        </div>
      </div>
    </div>
  );
}
