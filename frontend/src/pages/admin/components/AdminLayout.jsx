import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import '../styles/admin.css';

export default function AdminLayout({ activePage, children }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  // ESC key listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMobileOpen) setIsMobileOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen]);

  return (
    <div className="min-h-screen relative font-sans text-[#2D004D] bg-[#FFFDF9] overflow-x-hidden selection:bg-[#D8BFE3] selection:text-[#2D004D]">
      
      {/* Mobile Top Header (< 1024px) */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-[#8E6AA8]/10 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[#7B3FA0] text-sm">✧</span>
          <span className="font-bold text-[#2D004D] text-lg tracking-tight">Lumora</span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#8E6AA8] bg-[#7B3FA0]/10 px-2 py-0.5 rounded-full">
            Admin
          </span>
        </div>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-xl text-[#7B3FA0] hover:bg-[#7B3FA0]/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#7B3FA0]/30 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Open Navigation Menu"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile Drawer Overlay (< 1024px) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-[#2D004D]/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[280px] max-w-[85vw] h-full bg-[#FFFDF9] shadow-2xl flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#8E6AA8]/10">
              <div className="flex items-center gap-2">
                <span className="text-[#7B3FA0] text-sm">✧</span>
                <span className="font-bold text-[#2D004D] text-base">Navigation</span>
              </div>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-2 rounded-xl text-[#8E6AA8] hover:text-[#2D004D] hover:bg-[#7B3FA0]/10 transition-colors focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close Navigation Menu"
              >
                <X size={20} />
              </button>
            </div>
            <div onClick={() => setIsMobileOpen(false)}>
              <AdminSidebar activePage={activePage} isMobileDrawer={true} />
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="admin-layout-grid py-4 lg:py-6">
        {/* Desktop Sidebar (>= 1024px) */}
        <div className="hidden lg:block">
          <AdminSidebar activePage={activePage} />
        </div>

        {/* Main Content Area */}
        <div className="admin-main-content w-full min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

