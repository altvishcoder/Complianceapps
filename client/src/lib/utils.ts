import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parse, isValid, parseISO } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Default UK date format
const DEFAULT_DATE_FORMAT = "dd-MM-yyyy";
const DEFAULT_DATETIME_FORMAT = "dd-MM-yyyy HH:mm";

// Parse a date string that might be in various formats
function parseAnyDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const parsed = parseISO(dateStr);
    if (isValid(parsed)) return parsed;
  }
  
  // Try DD-MM-YYYY format
  if (dateStr.match(/^\d{2}-\d{2}-\d{4}/)) {
    const parsed = parse(dateStr, "dd-MM-yyyy", new Date());
    if (isValid(parsed)) return parsed;
  }
  
  // Try DD/MM/YYYY format
  if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    const parsed = parse(dateStr, "dd/MM/yyyy", new Date());
    if (isValid(parsed)) return parsed;
  }
  
  // Fallback to Date constructor
  const fallback = new Date(dateStr);
  return isValid(fallback) ? fallback : null;
}

// Format date to UK format (DD-MM-YYYY)
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  
  let date: Date | null;
  if (typeof dateInput === "string") {
    date = parseAnyDate(dateInput);
  } else {
    date = dateInput;
  }
  
  if (!date || !isValid(date)) return "-";
  
  return format(date, DEFAULT_DATE_FORMAT);
}

// Format datetime to UK format (DD-MM-YYYY HH:mm)
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  
  let date: Date | null;
  if (typeof dateInput === "string") {
    date = parseAnyDate(dateInput);
  } else {
    date = dateInput;
  }
  
  if (!date || !isValid(date)) return "-";
  
  return format(date, DEFAULT_DATETIME_FORMAT);
}

// Format date for display with custom format
export function formatDateCustom(
  dateInput: string | Date | null | undefined,
  formatStr: string = DEFAULT_DATE_FORMAT
): string {
  if (!dateInput) return "-";
  
  let date: Date | null;
  if (typeof dateInput === "string") {
    date = parseAnyDate(dateInput);
  } else {
    date = dateInput;
  }
  
  if (!date || !isValid(date)) return "-";
  
  return format(date, formatStr);
}

// Convert UK date (DD-MM-YYYY) to ISO format for storage (YYYY-MM-DD)
export function toISODate(dateStr: string): string | null {
  const date = parseAnyDate(dateStr);
  if (!date) return null;
  return format(date, "yyyy-MM-dd");
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  
  let date: Date | null;
  if (typeof dateInput === "string") {
    date = parseAnyDate(dateInput);
  } else {
    date = dateInput;
  }
  
  if (!date || !isValid(date)) return "-";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return formatDate(date);
}
