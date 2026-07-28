import React, { useState, useEffect, useRef, useId } from 'react';
import { Search, RefreshCw, AlertCircle, Inbox, ChevronDown, ChevronUp, Check, Grid, Filter, X, Sliders } from 'lucide-react';

// ─── 1. PAGE HEADER ────────────────────────────────────────────────────────
// Consistent Page Header with Title, Subtitle, and Right-Aligned Actions
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 md:mb-6 min-w-0 max-w-full">
      <div className="flex-1 min-w-0 max-w-full">
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-full bg-[#D8BFE3]/20 text-[#7B3FA0] text-[8px] sm:text-[9px] font-bold tracking-widest uppercase">
            MARKETPLACE ADMINISTRATION
          </span>
        </div>
        <h1 className="text-lg sm:text-2xl md:text-3xl font-serif text-[#2D004D] font-black tracking-tight leading-tight mb-1 break-words">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[#7B3FA0] text-xs font-light max-w-2xl leading-relaxed break-words">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0 min-w-0 w-full sm:w-auto justify-start sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

// ─── 2. STATS GRID ─────────────────────────────────────────────────────────
// Responsive 8px system grid container for statistics/analytics cards (2-column base on mobile)
export function StatsGrid({ children, columns = 4, className = "" }) {
  const gridColsClass = 
    columns === 6 
      ? "grid grid-cols-2 max-[320px]:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
      : columns === 3
        ? "grid grid-cols-2 max-[320px]:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid grid-cols-2 max-[320px]:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
      
  return (
    <div className={`stats-grid ${gridColsClass} gap-2.5 sm:gap-3.5 md:gap-5 mb-4 md:mb-6 ${className}`}>
      {children}
    </div>
  );
}

// ─── 3. DASHBOARD CARD (STATS CARD) ───────────────────────────────────────
// High-density, compact statistics/metrics display cards for enterprise mobile UX
export function DashboardCard({ title, value, icon: IconComponent, trend, trendLabel, onClick, chart, isLoading }) {
  const cardContent = (
    <>
      <div className="flex items-center justify-between mb-0.5 sm:mb-1 text-[#7B3FA0] min-w-0">
        <span className="text-[8px] sm:text-[9px] font-extrabold tracking-wider uppercase truncate max-w-[80%]">{title}</span>
        {IconComponent && typeof IconComponent === 'function' ? (
          <IconComponent size={11} className="text-[#7B3FA0] shrink-0 ml-1" />
        ) : (
          IconComponent
        )}
      </div>
      
      <h3 className="text-xs sm:text-base md:text-xl font-serif font-black text-[#2D004D] mb-0.5 transition-colors group-hover:text-[#5A1E7E] leading-tight truncate">
        {isLoading ? (
          <div className="h-4 bg-[#381347]/10 animate-pulse rounded-md w-2/3" />
        ) : (
          value
        )}
      </h3>
      
      <div className="flex items-center justify-between mt-0.5 min-h-[12px] sm:min-h-[14px]">
        {isLoading ? (
          <div className="h-2 bg-[#381347]/5 animate-pulse rounded-md w-1/2" />
        ) : (
          trend !== undefined && (
            <span className={`text-[7px] sm:text-[8px] font-bold px-1 py-0.2 rounded inline-flex items-center gap-0.5 ${
              parseFloat(trend) >= 0 || trend.toString().startsWith('+')
                ? 'text-[#059669] bg-[#10B981]/10' 
                : 'text-[#DC2626] bg-[#EF4444]/10'
            }`}>
              {trend} {trendLabel}
            </span>
          )
        )}
      </div>
      
      {chart && (
        <div className="h-3.5 sm:h-5 md:h-6 w-full mt-0.5 sm:mt-1 overflow-visible">
          {isLoading ? (
            <div className="h-full bg-[#381347]/5 animate-pulse rounded-md w-full" />
          ) : (
            chart
          )}
        </div>
      )}
    </>
  );

  const baseClass = "glass-surface rounded-lg sm:rounded-xl md:rounded-2xl p-2.5 sm:p-3 md:p-4 border border-white/50 hover:border-white/90 hover:-translate-y-0.5 transition-all duration-300 shadow-sm relative overflow-hidden group min-h-[76px] sm:min-h-[96px] md:min-h-[110px] flex flex-col justify-between h-full w-full box-border";
  
  if (onClick) {
    return (
      <button 
        type="button" 
        onClick={onClick} 
        className={`${baseClass} w-full text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7B3FA0]/30 min-h-[76px] sm:min-h-[96px]`}
      >
        {cardContent}
      </button>
    );
  }
  
  return (
    <div className={baseClass}>
      {cardContent}
    </div>
  );
}

// ─── 4. GLASS CARD (GENERAL WRAPPER) ──────────────────────────────────────
// Custom container element matching design details with compressed padding
export function GlassCard({ children, className = '', title, subtitle, headerActions }) {
  return (
    <div className={`glass-surface rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-white/50 shadow-sm relative overflow-hidden h-auto ${className}`}>
      {(title || subtitle || headerActions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3.5 mb-3.5 sm:mb-4 pb-2.5 sm:pb-3 border-b border-stone-200/50">
          <div>
            {subtitle && <h4 className="text-[8px] sm:text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">{subtitle}</h4>}
            {title && <h2 className="text-base sm:text-lg font-serif font-black text-[#2D004D] mt-0.5">{title}</h2>}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2 flex-wrap">
              {headerActions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── 5. FILTER BAR ────────────────────────────────────────────────────────
// Single-row horizontal search, filter, and action panel
export function FilterBar({ 
  searchValue, 
  onSearchChange, 
  searchPlaceholder = "Search records...", 
  filters = [], 
  actions 
}) {
  return (
    <div className="glass-surface rounded-2xl p-3 sm:p-3.5 border border-white/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 md:mb-6 relative z-30 overflow-visible">
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2.5 relative z-30 overflow-visible">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[200px] md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B3FA0] pointer-events-none" size={14} />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full pl-9 pr-3.5 h-[38px] sm:h-[40px] glass-input rounded-xl text-xs"
            />
          </div>
        )}
        
        {/* Render optional selector panels */}
        {filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 relative z-30 overflow-visible">
            {filters}
          </div>
        )}
      </div>
      
      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap min-w-0">
          {actions}
        </div>
      )}
    </div>
  );
}

// ─── 6. TABLE CONTAINER ───────────────────────────────────────────────────
// Standardized card wrapper for table sections with high-density padding
export function TableContainer({
  headers = [],
  children,
  isLoading,
  isEmpty,
  emptyTitle = "No records found",
  emptyDesc = "There is no matching data in our database.",
  emptyAction,
  columnsCount,
  pagination
}) {
  const cols = columnsCount || headers.length || 1;

  // When the caller passes headers/isLoading/isEmpty props, render the full
  // managed table layout. Otherwise render a plain card wrapper.
  const isManagedTable = headers.length > 0;

  if (isManagedTable) {
    return (
      <div className="flex flex-col gap-3.5">
        <div className="w-full overflow-x-auto rounded-2xl sm:rounded-3xl border border-white/50 bg-white/62 backdrop-blur-[40px] shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#8E6AA8]/5 border-b border-[#8E6AA8]/10">
                {headers.map((h, idx) => (
                  <th
                    key={idx}
                    className="px-3.5 py-2.5 sm:py-3 text-[9px] sm:text-[10px] font-extrabold tracking-widest text-[#7B3FA0] uppercase select-none"
                    style={h.style}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} className="border-b border-[#8E6AA8]/5 animate-pulse bg-white/30">
                    {Array.from({ length: cols }).map((_, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-3">
                        <div className="h-3.5 bg-[#381347]/10 rounded w-3/4 my-0.5" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : isEmpty ? (
                <tr>
                  <td colSpan={cols} className="p-0">
                    <EmptyState
                      title={emptyTitle}
                      description={emptyDesc}
                      action={emptyAction}
                    />
                  </td>
                </tr>
              ) : (
                children
              )}
            </tbody>
          </table>
        </div>
        {pagination && (
          <div className="flex items-center justify-between px-3.5 py-1.5 mt-1">
            {pagination}
          </div>
        )}
      </div>
    );
  }

  // Plain card wrapper — used by pages that manage their own table structure
  return (
    <div className="w-full rounded-2xl sm:rounded-3xl border border-white/50 bg-white/62 backdrop-blur-[40px] shadow-sm overflow-hidden">
      {children}
      {pagination && (
        <div className="flex items-center justify-between px-3.5 py-1.5 mt-1">
          {pagination}
        </div>
      )}
    </div>
  );
}

// ─── 7. EMPTY STATE ───────────────────────────────────────────────────────
// Visually appealing vector card for tables/sections without entries
export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-10 bg-white/40 rounded-3xl border border-dashed border-[#8E6AA8]/20 min-h-[220px] sm:min-h-[260px]">
      <div className="w-12 h-12 rounded-xl bg-[#D8BFE3]/15 flex items-center justify-center text-[#7B3FA0] mb-3">
        <Inbox size={24} className="opacity-75" />
      </div>
      <h3 className="text-base font-serif font-black text-[#2D004D] mb-1">{title}</h3>
      <p className="text-xs text-[#7B3FA0] max-w-sm leading-relaxed mb-4">{description}</p>
      {action && (
        <div className="flex justify-center">
          {action}
        </div>
      )}
    </div>
  );
}

// ─── 8. LOADING STATE ─────────────────────────────────────────────────────
// Premium layouts replacing spinner screens
export function LoadingState({ type = "table", count = 3 }) {
  if (type === "cards") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm animate-pulse bg-white/40">
            <div className="flex justify-between items-center mb-4">
              <div className="h-3 bg-[#381347]/10 rounded w-1/3" />
              <div className="h-6 w-6 rounded-full bg-[#381347]/10" />
            </div>
            <div className="h-8 bg-[#381347]/15 rounded w-1/2 mb-3" />
            <div className="h-3 bg-[#381347]/5 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4 animate-pulse">
      <div className="h-[42px] bg-[#381347]/5 rounded-xl w-1/4 mb-2" />
      <div className="h-[300px] bg-white/40 border border-white/50 rounded-3xl w-full" />
    </div>
  );
}

// ─── 9. ADMIN SELECT (PREMIUM GLASS POPOVER DROPDOWN) ─────────────────────
// Custom popover dropdown panel with floating glass container, option icons, and checkmarks
export function AdminSelect({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Select...", 
  icon: LeadIcon,
  className = "",
  disabled = false,
  name = "",
  id = "",
  ariaLabel = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const optionRefs = useRef([]);
  const generatedId = useId();
  const listboxId = `admin-select-listbox-${id || generatedId}`;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Format options if passed as raw strings, numbers or objects
  const parsedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return { 
        value: opt.value, 
        label: opt.label !== undefined ? opt.label : String(opt.value), 
        icon: opt.icon || null,
        disabled: Boolean(opt.disabled)
      };
    }
    return { value: opt, label: String(opt), icon: null, disabled: false };
  });

  const selectedOpt = parsedOptions.find(o => String(o.value) === String(value)) || {
    value: value !== undefined && value !== null ? value : '',
    label: value !== undefined && value !== null && value !== '' ? String(value) : placeholder,
    icon: null
  };

  useEffect(() => {
    if (isOpen) {
      const selectedIndex = parsedOptions.findIndex(o => String(o.value) === String(value));
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, value]);

  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  const handleSelect = (optValue) => {
    setIsOpen(false);
    if (buttonRef.current) buttonRef.current.focus();
    if (onChange) {
      // Fire synthetic event for 100% backwards compatibility with e.target.value handlers
      const event = {
        target: { value: optValue, name },
        currentTarget: { value: optValue, name },
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      onChange(event);
    }
  };

  const handleKeyDownToggle = (e) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  const handleKeyDownOption = (e, index) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (index + 1) % parsedOptions.length;
      setFocusedIndex(nextIndex);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = (index - 1 + parsedOptions.length) % parsedOptions.length;
      setFocusedIndex(prevIndex);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!parsedOptions[index].disabled) {
        handleSelect(parsedOptions[index].value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      if (buttonRef.current) buttonRef.current.focus();
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left min-w-[120px] ${isOpen ? 'z-50' : 'z-10'} ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        id={id || undefined}
        name={name || undefined}
        disabled={disabled}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel || placeholder || name || "Select option"}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDownToggle}
        className={`w-full h-[40px] px-3.5 rounded-xl bg-white/90 backdrop-blur-xl border transition-all duration-200 flex items-center justify-between gap-2.5 text-xs font-bold text-[#2D004D] shadow-[0_2px_10px_rgba(90,30,126,0.06)] hover:bg-white hover:shadow-[0_4px_16px_rgba(123,63,160,0.12)] focus:outline-none focus:ring-2 focus:ring-[#7B3FA0]/30 disabled:opacity-60 disabled:cursor-not-allowed ${
          isOpen
            ? 'border-[#7B3FA0] ring-2 ring-[#7B3FA0]/25 bg-white shadow-[0_4px_20px_rgba(123,63,160,0.16)]'
            : 'border-[#C4B5FD]/50 hover:border-[#7B3FA0]/60'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          {LeadIcon ? (
            <LeadIcon size={14} className="text-[#7B3FA0] flex-shrink-0" />
          ) : selectedOpt.icon ? (
            <selectedOpt.icon size={14} className="text-[#7B3FA0] flex-shrink-0" />
          ) : (
            <Grid size={14} className="text-[#7B3FA0]/70 flex-shrink-0" />
          )}
          <span className="truncate tracking-tight">{selectedOpt.label}</span>
        </div>
        <ChevronDown 
          size={14} 
          className={`text-[#7B3FA0] transition-transform duration-250 ease-out flex-shrink-0 ${isOpen ? 'rotate-180 text-[#5A1E7E]' : 'opacity-80'}`} 
        />
      </button>

      {isOpen && (
        <div 
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel || placeholder || name}
          className="absolute right-0 sm:left-0 top-[calc(100%+6px)] z-50 min-w-[180px] sm:min-w-[200px] w-max max-w-[calc(100vw-32px)] sm:max-w-[320px] max-h-[280px] overflow-y-auto rounded-2xl bg-white/98 backdrop-blur-2xl border border-[#C4B5FD]/70 shadow-[0_20px_50px_rgba(45,0,77,0.25)] p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150"
        >
          {parsedOptions.map((opt, index) => {
            const isSelected = String(opt.value) === String(value);
            const isFocused = index === focusedIndex;
            const OptionIcon = opt.icon;
            return (
              <button
                key={`${opt.value}-${index}`}
                ref={(el) => (optionRefs.current[index] = el)}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onClick={() => !opt.disabled && handleSelect(opt.value)}
                onKeyDown={(e) => handleKeyDownOption(e, index)}
                className={`w-full px-3 py-2 rounded-xl text-left text-xs flex items-center justify-between transition-all duration-150 outline-none ${
                  isSelected
                    ? 'bg-[#7B3FA0]/12 text-[#7B3FA0] font-extrabold shadow-xs'
                    : isFocused
                    ? 'bg-[#7B3FA0]/08 text-[#5A1E7E] font-bold'
                    : 'text-[#2D004D] font-semibold hover:bg-[#7B3FA0]/06 hover:text-[#5A1E7E]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {OptionIcon ? (
                    <OptionIcon size={14} className={isSelected ? 'text-[#7B3FA0]' : 'text-[#7B3FA0]/60'} />
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isSelected ? 'bg-[#7B3FA0] scale-125' : 'bg-[#D8BFE3]/60'}`} />
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && <Check size={14} className="text-[#7B3FA0] flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 8. MOBILE SECTION SWITCHER (NAV REDESIGN) ──────────────────────────────
// Enterprise mobile section navigation: Pill list on desktop, Dropdown + Bottom Sheet on mobile.
export function MobileSectionSwitcher({ sections = [], activeSection, onChange, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const activeObj = sections.find(s => s.id === activeSection) || sections[0] || { id: '', label: 'Select Section' };
  const ActiveIcon = activeObj.icon;

  return (
    <div className={`w-full ${className}`}>
      {/* Desktop View (>= 768px): Horizontal Pill Bar */}
      <div className="hidden md:flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/70 backdrop-blur-md border border-stone-200/50 shadow-xs flex-wrap">
        {sections.map(sec => {
          const isActive = sec.id === activeSection;
          const SecIcon = sec.icon;
          return (
            <button
              key={sec.id}
              onClick={() => onChange(sec.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border-none cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-[#7B3FA0] to-[#5A1E7E] text-white shadow-sm'
                  : 'text-[#7B3FA0] hover:bg-[#F3EAF8]/60 hover:text-[#2D004D]'
              }`}
            >
              {SecIcon && <SecIcon size={14} />}
              <span>{sec.label}</span>
              {sec.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#F3EAF8] text-[#7B3FA0]'
                }`}>
                  {sec.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile View (< 768px): Dropdown Switcher Bar */}
      <div className="md:hidden w-full">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full px-4 py-3 rounded-2xl bg-white/95 border border-[#C4B5FD]/70 shadow-sm flex items-center justify-between text-xs font-bold text-[#2D004D] active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[9px] uppercase tracking-widest font-extrabold text-[#7B3FA0]">Section:</span>
            {ActiveIcon && <ActiveIcon size={15} className="text-[#7B3FA0] shrink-0" />}
            <span className="truncate font-black">{activeObj.label}</span>
            {activeObj.count !== undefined && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-[#F8F3FB] text-[#7B3FA0] border border-[#F3EAF8]">
                {activeObj.count}
              </span>
            )}
          </div>
          <ChevronDown size={16} className="text-[#7B3FA0] shrink-0 ml-2" />
        </button>

        {/* Bottom Sheet Drawer for Section Selection */}
        {isOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div 
              className="fixed inset-0" 
              onClick={() => setIsOpen(false)} 
            />
            <div className="relative w-full max-h-[85vh] bg-white rounded-t-3xl p-5 shadow-2xl flex flex-col gap-4 z-10 border-t border-stone-200 overflow-y-auto animate-in slide-in-from-bottom duration-250">
              <div className="w-12 h-1.5 rounded-full bg-stone-300 mx-auto -mt-1 mb-1" />
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#7B3FA0]">Switch View</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full bg-stone-100 text-[#7B3FA0] hover:bg-stone-200 transition-colors border-none"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {sections.map(sec => {
                  const isActive = sec.id === activeSection;
                  const SecIcon = sec.icon;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => {
                        onChange(sec.id);
                        setIsOpen(false);
                      }}
                      className={`w-full min-h-[48px] px-4 py-3 rounded-2xl text-left text-xs font-bold flex items-center justify-between transition-all border-none cursor-pointer ${
                        isActive
                          ? 'bg-[#7B3FA0]/15 text-[#7B3FA0] border border-[#7B3FA0]/30 font-black'
                          : 'bg-[#F8F3FB]/50 text-[#2D004D] hover:bg-[#F8F3FB]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {SecIcon && <SecIcon size={16} className={isActive ? 'text-[#7B3FA0]' : 'text-[#7B3FA0]/60'} />}
                        <span>{sec.label}</span>
                      </div>
                      {sec.count !== undefined && (
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-[#7B3FA0] text-white' : 'bg-[#F3EAF8] text-[#7B3FA0]'
                        }`}>
                          {sec.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 9. MOBILE FILTER DRAWER & TRIGGER ─────────────────────────────────────
// Mobile slide-up Bottom Sheet for filters (Sort, Status, Category, Range)
export function MobileFilterTrigger({ activeCount = 0, onClick, label = "Filter & Sort" }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[#C4B5FD]/70 text-[#7B3FA0] text-xs font-extrabold shadow-xs active:scale-95 transition-all"
    >
      <Sliders size={14} />
      <span>{label}</span>
      {activeCount > 0 && (
        <span className="w-5 h-5 rounded-full bg-[#7B3FA0] text-white text-[10px] font-extrabold flex items-center justify-center">
          {activeCount}
        </span>
      )}
    </button>
  );
}

export function MobileFilterDrawer({ isOpen, onClose, onApply, onReset, title = "Filter & Sort", children }) {
  if (!isOpen) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative w-full max-h-[90vh] bg-white rounded-t-3xl p-5 shadow-2xl flex flex-col gap-4 z-10 border-t border-stone-200 overflow-y-auto animate-in slide-in-from-bottom duration-250">
        <div className="w-12 h-1.5 rounded-full bg-stone-300 mx-auto -mt-1 mb-1" />
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-[#7B3FA0]" />
            <h3 className="text-sm font-serif font-black text-[#2D004D]">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-stone-100 text-[#7B3FA0] hover:bg-stone-200 border-none cursor-pointer">
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-4 py-2">
          {children}
        </div>

        <div className="flex items-center gap-3 pt-3 border-t border-stone-100 mt-2">
          {onReset && (
            <button
              onClick={() => { onReset(); onClose(); }}
              className="flex-1 min-h-[44px] py-3 rounded-xl border border-stone-200 bg-stone-50 text-stone-600 text-xs font-bold transition-all"
            >
              Reset Filters
            </button>
          )}
          <button
            onClick={() => { if (onApply) onApply(); onClose(); }}
            className="flex-1 min-h-[44px] py-3 rounded-xl bg-gradient-to-r from-[#7B3FA0] to-[#5A1E7E] text-white text-xs font-bold shadow-md transition-all"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 10. MOBILE RECORD CARD & EXPANDABLE DETAILS ───────────────────────────
// Enterprise-grade mobile card record view with progressive disclosure accordion
export function MobileRecordCard({ title, subtitle, badge, status, price, avatar, details, actions, children, onClick }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      onClick={onClick}
      className="md:hidden p-4 rounded-2xl bg-white border border-stone-200/70 shadow-xs flex flex-col gap-3 transition-all hover:border-[#7B3FA0]/40"
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-2.5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {avatar && (
            <div className="shrink-0">{avatar}</div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-[#2D004D] text-xs leading-snug break-words">{title}</h4>
            {subtitle && <p className="text-[10px] text-[#7B3FA0] mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-1">
          {status && <div>{status}</div>}
          {price && <span className="font-black text-xs text-[#2D004D]">{price}</span>}
          {badge && <div>{badge}</div>}
        </div>
      </div>

      {/* Main Grid / Body Content */}
      {children && <div className="text-xs text-[#2D004D] space-y-2">{children}</div>}

      {/* Expandable Secondary Details Drawer */}
      {details && (
        <div className="border-t border-stone-100 pt-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
            className="w-full flex items-center justify-between py-1 text-[10px] font-bold text-[#7B3FA0] uppercase tracking-wider border-none bg-transparent cursor-pointer"
          >
            <span>{isExpanded ? 'Hide Details' : 'View Full Details'}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {isExpanded && (
            <div className="mt-2.5 p-3 rounded-xl bg-[#F8F3FB]/70 border border-[#F3EAF8] text-xs text-[#2D004D] space-y-2 animate-in fade-in duration-150">
              {details}
            </div>
          )}
        </div>
      )}

      {/* Action Footer Bar (Minimum 44px touch targets) */}
      {actions && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
