/**
 * Utility for merging and deduplicating Tailwind CSS class names.
 *
 * Combines class names using clsx and merges them with tailwind-merge for optimal deduplication.
 * Usage: cn('p-2', condition && 'bg-blue-500', ...)
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
