import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DOCUMENT_TAGS = [
  'Originating processes',
  'Agreement',
  'Evidence',
  'Correspondence',
  'Court filing',
  'Misc.',
] as const;

const roleLabelMap: Record<string, string> = {
  admin: 'Head Legal',
  lawyer: 'Counsel',
  viewer: 'External Counsel',
};

export function getRoleLabel(role: string): string {
  return roleLabelMap[role] || role;
}
