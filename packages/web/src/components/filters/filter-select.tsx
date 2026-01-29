"use client";

import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  label: string;
  value: string | string[];
  options: FilterOption[];
  onChange: (value: string) => void;
  onMultiChange?: (values: string[]) => void;
  icon?: React.ReactNode;
  placeholder?: string;
  multiple?: boolean;
  className?: string;
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  onMultiChange,
  icon,
  placeholder,
  multiple = false,
  className,
}: FilterSelectProps) {
  if (multiple && onMultiChange) {
    const selectedValues = Array.isArray(value) ? value : [];

    return (
      <div className={cn("relative", className)}>
        <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const isSelected = selectedValues.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => {
                  if (isSelected) {
                    onMultiChange(selectedValues.filter((v) => v !== opt.value));
                  } else {
                    onMultiChange([...selectedValues, opt.value]);
                  }
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  isSelected
                    ? "bg-brand-500 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const currentValue = Array.isArray(value) ? value[0] || "" : value;

  return (
    <div className={cn("relative", className)}>
      <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}
        <select
          value={currentValue}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full appearance-none rounded-lg border border-gray-200 bg-white py-2 pr-8 text-sm transition-colors hover:border-gray-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500",
            "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-500",
            icon ? "pl-9" : "pl-3"
          )}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      </div>
    </div>
  );
}
