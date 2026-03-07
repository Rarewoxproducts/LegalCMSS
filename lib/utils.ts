import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const roleLabelMap: Record<string, string> = {
  admin: 'Head Legal',
  lawyer: 'Counsel',
  viewer: 'External Counsel',
};

export function getRoleLabel(role: string): string {
  return roleLabelMap[role] || role;
}
