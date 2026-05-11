import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncatePath(path: string, levels = 2): string {
  const parts = path.replace(/\\/g, '/').split('/')
  if (parts.length <= levels) return path
  return '.../' + parts.slice(-levels).join('/')
}
