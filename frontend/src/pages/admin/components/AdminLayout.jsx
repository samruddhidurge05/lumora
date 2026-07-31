import React, { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import AdminSidebar from './AdminSidebar';
import '../styles/admin.css';

export default function AdminLayout({ activePage, children }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.classList.add('admin-scroll-locked');
    } else {
      document.body.classList.remove('admin-scroll-locked');
    }
    return () => { document.body.classList.remove('admin-scroll-locked'); };
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
    <div className="min-h-screen relative font-sans text-[#2D004D] bg-[#ffffff] overflow-x-hidden selection:bg-[#D8BFE3] selection:text-[#2D004D]">
      
      {/* Mobile Top Header (< 1024px) */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-xl border-b border-[#8E6AA8]/15 shadow-sm min-h-[56px]">
        <div className="flex items-center gap-2">
          <span className="text-[#7B3FA0] text-sm">✧</span>
          <span className="font-bold text-[#2D004D] text-lg tracking-tight">Lumora</span>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#8E6AA8] bg-[#7B3FA0]/10 px-2.5 py-0.5 rounded-full">
            Admin
          </span>
        </div>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2.5 rounded-xl text-[#7B3FA0] hover:bg-[#7B3FA0]/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[#7B3FA0]/30 min-w-[48px] min-h-[48px] flex items-center justify-center admin-btn-tactile"
          aria-label="Open Navigation Menu"
        >
          <Menu size={24} />
        </button>
      </header>

      {/* Mobile Drawer Overlay (< 1024px) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-[#2D004D]/50 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[290px] max-w-[85vw] h-full bg-[#ffffff] shadow-2xl flex flex-col p-4 overflow-y-auto animate-in slide-in-from-left duration-250">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#8E6AA8]/10">
              <div className="flex items-center gap-2">
                <span className="text-[#7B3FA0] text-sm">✧</span>
                <span className="font-bold text-[#2D004D] text-base">Navigation</span>
              </div>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="p-2.5 rounded-xl text-[#8E6AA8] hover:text-[#2D004D] hover:bg-[#7B3FA0]/10 transition-colors focus:outline-none min-w-[48px] min-h-[48px] flex items-center justify-center admin-btn-tactile"
                aria-label="Close Navigation Menu"
              >
                <X size={22} />
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

        {/* Main Content Area with Seamless 180ms Page Fade Transition */}
        <div className="admin-main-content w-full min-w-0">
          <div key={activePage} className="admin-page-transition w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

