import React, { useState, useEffect, useRef, useId } from 'react';
import { Search, RefreshCw, AlertCircle, Inbox, ChevronDown, Check, Grid, Filter, Layers, Sparkles } from 'lucide-react';

// ─── 1. PAGE HEADER ────────────────────────────────────────────────────────
// Consistent Page Header with Title, Subtitle, and Right-Aligned Actions
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 rounded-full bg-[#D8BFE3]/20 text-[#7B3FA0] text-[9px] font-bold tracking-widest uppercase">
            MARKETPLACE ADMINISTRATION
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-serif text-[#2D004D] font-black tracking-tight leading-tight mb-2">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[#7B3FA0] text-xs font-light max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

// ─── 2. STATS GRID ─────────────────────────────────────────────────────────
// Responsive 8px system grid container for statistics/analytics cards
export function StatsGrid({ children, columns = 4 }) {
  const gridColsClass = 
    columns === 6 
      ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
      : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
      
  return (
    <div className={`${gridColsClass} gap-6 mb-8`}>
      {children}
    </div>
  );
}

// ─── 3. DASHBOARD CARD (STATS CARD) ───────────────────────────────────────
// Identical statistics/metrics display cards following the design guidelines
export function DashboardCard({ title, value, icon: IconComponent, trend, trendLabel, onClick, chart, isLoading }) {
  const cardContent = (
    <>
      <div className="flex items-center justify-between mb-3 text-[#7B3FA0]">
        <span className="text-[8px] font-extrabold tracking-widest uppercase">{title}</span>
        {IconComponent && typeof IconComponent === 'function' ? (
          <IconComponent size={14} className="text-[#7B3FA0]" />
        ) : (
          IconComponent
        )}
      </div>
      
      <h3 className="text-2xl font-serif font-black text-[#2D004D] mb-1.5 transition-colors group-hover:text-[#5A1E7E]">
        {isLoading ? (
          <div className="h-8 bg-[#381347]/10 animate-pulse rounded-md w-2/3" />
        ) : (
          value
        )}
      </h3>
      
      <div className="flex items-center justify-between mt-2 min-h-[20px]">
        {isLoading ? (
          <div className="h-3 bg-[#381347]/5 animate-pulse rounded-md w-1/2" />
        ) : (
          trend !== undefined && (
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${
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
        <div className="h-8 w-full mt-3 overflow-visible">
          {isLoading ? (
            <div className="h-full bg-[#381347]/5 animate-pulse rounded-md w-full" />
          ) : (
            chart
          )}
        </div>
      )}
    </>
  );

  const baseClass = "glass-surface rounded-3xl p-5 border border-white/50 hover:border-white/90 hover:-translate-y-1 transition-all duration-500 shadow-sm relative overflow-hidden group";
  
  if (onClick) {
    return (
      <button 
        type="button" 
        onClick={onClick} 
        className={`${baseClass} w-full text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#7B3FA0]/30`}
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
// Custom container element matching design details
export function GlassCard({ children, className = '', title, subtitle, headerActions }) {
  return (
    <div className={`glass-surface rounded-3xl p-6 border border-white/50 shadow-sm relative overflow-hidden ${className}`}>
      {(title || subtitle || headerActions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-stone-200/50">
          <div>
            {subtitle && <h4 className="text-[9px] font-extrabold tracking-widest text-[#8E6AA8] uppercase">{subtitle}</h4>}
            {title && <h2 className="text-lg font-serif font-black text-[#2D004D] mt-0.5">{title}</h2>}
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">
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
    <div className="glass-surface rounded-2xl p-4 border border-white/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[200px] md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7B3FA0] pointer-events-none" size={15} />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-4 h-[42px] glass-input rounded-xl text-xs"
            />
          </div>
        )}
        
        {/* Render optional selector panels */}
        {filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {filters}
          </div>
        )}
      </div>
      
      {actions && (
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap md:flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

// ─── 6. TABLE CONTAINER ───────────────────────────────────────────────────
// ─── 6. TABLE CONTAINER ───────────────────────────────────────────────────
// Standardized card wrapper for table sections. Children are rendered directly
// inside the card — they must include their own <table> / <tr> / <td> structure.
// NOTE: This is intentionally a <div> wrapper, not a <table>, so that callers
// can pass any content (headers, spinners, overflow wrappers, full tables, etc.)
// without triggering validateDOMNesting warnings.
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
      <div className="flex flex-col gap-4">
        <div className="w-full overflow-x-auto rounded-3xl border border-white/50 bg-white/62 backdrop-blur-[40px] shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#8E6AA8]/5 border-b border-[#8E6AA8]/10">
                {headers.map((h, idx) => (
                  <th
                    key={idx}
                    className="p-4 text-[10px] font-extrabold tracking-widest text-[#7B3FA0] uppercase select-none"
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
                      <td key={cIdx} className="p-4">
                        <div className="h-4 bg-[#381347]/10 rounded w-3/4 my-1" />
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
          <div className="flex items-center justify-between px-4 py-2 mt-2">
            {pagination}
          </div>
        )}
      </div>
    );
  }

  // Plain card wrapper — used by pages that manage their own table structure
  return (
    <div className="w-full rounded-3xl border border-white/50 bg-white/62 backdrop-blur-[40px] shadow-sm overflow-hidden">
      {children}
      {pagination && (
        <div className="flex items-center justify-between px-4 py-2 mt-2">
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
    <div className="flex flex-col items-center justify-center text-center p-12 bg-white/40 rounded-3xl border border-dashed border-[#8E6AA8]/20 min-h-[300px]">
      <div className="w-16 h-16 rounded-2xl bg-[#D8BFE3]/15 flex items-center justify-center text-[#7B3FA0] mb-4">
        <Inbox size={28} className="opacity-75" />
      </div>
      <h3 className="text-base font-serif font-black text-[#2D004D] mb-1.5">{title}</h3>
      <p className="text-xs text-[#7B3FA0] max-w-sm leading-relaxed mb-6">{description}</p>
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
    <div ref={containerRef} className={`relative inline-block text-left min-w-[150px] ${className}`}>
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
        className="w-full h-[42px] px-3.5 rounded-xl bg-white/80 backdrop-blur-md border border-[#C4B5FD]/50 hover:border-[#7B3FA0]/60 hover:bg-white shadow-sm flex items-center justify-between gap-2.5 text-xs font-bold text-[#2D004D] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#7B3FA0]/30 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2 truncate">
          {LeadIcon ? (
            <LeadIcon size={14} className="text-[#7B3FA0] flex-shrink-0" />
          ) : selectedOpt.icon ? (
            <selectedOpt.icon size={14} className="text-[#7B3FA0] flex-shrink-0" />
          ) : (
            <Grid size={14} className="text-[#7B3FA0]/70 flex-shrink-0" />
          )}
          <span className="truncate">{selectedOpt.label}</span>
        </div>
        <ChevronDown 
          size={14} 
          className={`text-[#7B3FA0] transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div 
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel || placeholder || name}
          className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[220px] w-full max-h-[300px] overflow-y-auto rounded-2xl bg-white/95 backdrop-blur-2xl border border-[#C4B5FD]/60 shadow-[0_16px_40px_rgba(90,30,126,0.18)] p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150"
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
                    ? 'bg-[#7B3FA0]/12 text-[#7B3FA0] font-extrabold'
                    : isFocused
                    ? 'bg-[#7B3FA0]/08 text-[#5A1E7E] font-semibold'
                    : 'text-[#2D004D] font-semibold hover:bg-[#7B3FA0]/06 hover:text-[#5A1E7E]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {OptionIcon ? (
                    <OptionIcon size={14} className={isSelected ? 'text-[#7B3FA0]' : 'text-[#7B3FA0]/60'} />
                  ) : (
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-[#7B3FA0]' : 'bg-[#D8BFE3]/50'}`} />
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
