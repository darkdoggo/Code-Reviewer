/**
 * Theme color system
 * Handles primary color derivation, dark mode adjustment, and CSS variable application
 */

export interface ThemeColorDef {
  value: string
  label: string
  hex: string
  h: number
  s: number
  l: number
}

export const PRESET_THEME_COLORS: ThemeColorDef[] = [
  { value: 'purple', label: '默认紫', hex: '#8b5cf6', h: 262, s: 83, l: 58 },
  { value: 'blue',   label: '科技蓝', hex: '#3b82f6', h: 217, s: 91, l: 60 },
  { value: 'orange', label: '活力橙', hex: '#f97316', h: 25,  s: 95, l: 53 },
  { value: 'green',  label: '自然绿', hex: '#22c55e', h: 142, s: 71, l: 45 },
  { value: 'gray',   label: '专业灰', hex: '#64748b', h: 215, s: 16, l: 47 },
  { value: 'red',    label: '热情红', hex: '#ef4444', h: 0,   s: 72, l: 51 },
  { value: 'cyan',   label: '青色',   hex: '#06b6d4', h: 189, s: 94, l: 43 },
  { value: 'pink',   label: '粉色',   hex: '#ec4899', h: 330, s: 81, l: 60 },
]

export interface DerivedColors {
  primary: string
  primaryHover: string
  primaryActive: string
  primaryLight: string
  primaryForeground: string
  primaryDark: string
  ring: string
}

/** Derive all theme color variants from a base HSL */
export function deriveThemeColors(h: number, s: number, l: number): DerivedColors {
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
  // foreground: white for dark colors, black for light colors
  const fg = l > 65 ? '0 0% 10%' : '0 0% 100%'

  return {
    primary:           `${h} ${s}% ${l}%`,
    primaryHover:      `${h} ${s}% ${clamp(l + 8, 20, 92)}%`,
    primaryActive:     `${h} ${s}% ${clamp(l - 8, 10, 85)}%`,
    primaryLight:      `${h} ${clamp(s - 40, 10, 100)}% ${clamp(l + 25, 50, 96)}%`,
    primaryForeground: fg,
    primaryDark:       `${h} ${s}% ${clamp(l - 8, 10, 85)}%`,
    ring:              `${h} ${s}% ${l}%`,
  }
}

/** Adjust colors for dark mode */
export function adjustForDarkMode(h: number, s: number, l: number): DerivedColors {
  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
  const darkL = clamp(l + 12, 30, 90)

  return {
    primary:           `${h} ${s}% ${darkL}%`,
    primaryHover:      `${h} ${s}% ${clamp(darkL + 8, 30, 95)}%`,
    primaryActive:     `${h} ${s}% ${clamp(darkL - 8, 20, 85)}%`,
    primaryLight:      `${h} ${clamp(s - 40, 10, 100)}% ${clamp(l - 10, 10, 40)}%`,
    primaryForeground: '0 0% 100%',
    primaryDark:       `${h} ${s}% ${clamp(darkL - 8, 20, 85)}%`,
    ring:              `${h} ${s}% ${darkL}%`,
  }
}

/** Apply theme colors to CSS variables on :root */
export function applyThemeColor(h: number, s: number, l: number) {
  const root = document.documentElement
  const isDark = root.classList.contains('dark')

  const colors = isDark
    ? adjustForDarkMode(h, s, l)
    : deriveThemeColors(h, s, l)

  root.style.setProperty('--primary', colors.primary)
  root.style.setProperty('--primary-hover', colors.primaryHover)
  root.style.setProperty('--primary-active', colors.primaryActive)
  root.style.setProperty('--primary-light', colors.primaryLight)
  root.style.setProperty('--primary-foreground', colors.primaryForeground)
  root.style.setProperty('--primary-dark', colors.primaryDark)
  root.style.setProperty('--ring', colors.ring)
}

/** Parse hex color to HSL */
export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

/** Convert HSL to hex */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}
