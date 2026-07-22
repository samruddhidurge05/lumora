import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * CustomSelect - Accessible Custom Dropdown Component
 * Replaces native <select> visuals while preserving 100% existing state & event behavior.
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  name = "",
  id = "",
  disabled = false,
  className = "",
  style = {},
  ariaLabel = "",
  icon: LeadIcon = null,
  size = "md", // "sm" | "md" | "lg"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const optionRefs = useRef([]);
  const generatedId = useId();
  const listboxId = `custom-select-listbox-${id || generatedId}`;

  // Parse options array (supports strings, numbers, or { value, label, icon } objects)
  const parsedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt.value,
        label: opt.label !== undefined ? opt.label : String(opt.value),
        icon: opt.icon || null,
        disabled: Boolean(opt.disabled),
      };
    }
    return {
      value: opt,
      label: String(opt),
      icon: null,
      disabled: false,
    };
  });

  // Find active selected option
  const selectedOpt = parsedOptions.find(
    (o) => String(o.value) === String(value)
  ) || {
    value: value !== undefined && value !== null ? value : '',
    label: value !== undefined && value !== null && value !== '' ? String(value) : placeholder,
    icon: null,
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update focused index when dropdown opens or value changes
  useEffect(() => {
    if (isOpen) {
      const selectedIndex = parsedOptions.findIndex(
        (o) => String(o.value) === String(value)
      );
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, value]);

  // Focus the option element when focusedIndex changes
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  const handleSelect = (optValue) => {
    setIsOpen(false);
    if (buttonRef.current) {
      buttonRef.current.focus();
    }
    if (onChange) {
      // Dispatch synthetic event matching standard HTML select onChange interface
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

  // Size styling variables
  const sizeStyles = {
    sm: {
      height: '32px',
      padding: '4px 10px',
      fontSize: '0.75rem',
      borderRadius: '10px',
    },
    md: {
      height: '40px',
      padding: '8px 14px',
      fontSize: '0.82rem',
      borderRadius: '12px',
    },
    lg: {
      height: '46px',
      padding: '10px 16px',
      fontSize: '0.88rem',
      borderRadius: '14px',
    },
  };

  const currentSize = sizeStyles[size] || sizeStyles.md;

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        minWidth: '130px',
        opacity: disabled ? 0.6 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        ...style,
      }}
    >
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
        style={{
          width: '100%',
          height: currentSize.height,
          padding: currentSize.padding,
          fontSize: currentSize.fontSize,
          borderRadius: currentSize.borderRadius,
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: isOpen ? '1px solid #7B3FA0' : '1px solid rgba(196, 181, 253, 0.45)',
          boxShadow: isOpen
            ? '0 0 0 3px rgba(123, 63, 160, 0.18)'
            : '0 2px 8px rgba(90, 30, 126, 0.05)',
          color: '#2D004D',
          fontWeight: 600,
          fontFamily: 'var(--font-sans, inherit)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {LeadIcon && <LeadIcon size={14} style={{ color: '#7B3FA0', flexShrink: 0 }} />}
          {selectedOpt.icon && <selectedOpt.icon size={14} style={{ color: '#7B3FA0', flexShrink: 0 }} />}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedOpt.label}
          </span>
        </div>
        <ChevronDown
          size={14}
          style={{
            color: '#7B3FA0',
            flexShrink: 0,
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel || placeholder || name}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            minWidth: '100%',
            maxWidth: '320px',
            maxHeight: '260px',
            overflowY: 'auto',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(196, 181, 253, 0.55)',
            boxShadow: '0 16px 36px rgba(45, 0, 77, 0.18)',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {parsedOptions.map((opt, index) => {
            const isSelected = String(opt.value) === String(value);
            const isFocused = index === focusedIndex;
            const OptIcon = opt.icon;

            return (
              <div
                key={`${opt.value}-${index}`}
                ref={(el) => (optionRefs.current[index] = el)}
                role="option"
                tabIndex={0}
                aria-selected={isSelected}
                aria-disabled={opt.disabled}
                onClick={() => !opt.disabled && handleSelect(opt.value)}
                onKeyDown={(e) => handleKeyDownOption(e, index)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  fontSize: currentSize.fontSize,
                  fontFamily: 'var(--font-sans, inherit)',
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? '#7B3FA0' : '#2D004D',
                  background: isSelected
                    ? 'rgba(123, 63, 160, 0.10)'
                    : isFocused
                    ? 'rgba(123, 63, 160, 0.05)'
                    : 'transparent',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  outline: 'none',
                  transition: 'background 0.15s ease, color 0.15s ease',
                  opacity: opt.disabled ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {OptIcon ? (
                    <OptIcon
                      size={14}
                      style={{ color: isSelected ? '#7B3FA0' : 'rgba(123, 63, 160, 0.6)', flexShrink: 0 }}
                    />
                  ) : (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: isSelected ? '#7B3FA0' : 'rgba(196, 181, 253, 0.5)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                </div>
                {isSelected && <Check size={14} style={{ color: '#7B3FA0', flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
