interface Props {
  size?: number
  className?: string
}

/**
 * App icon — matches icon-option-3.svg exactly
 * White/light-gray rounded square + filled purple shield + white </> code symbol
 */
export function AppIcon({ size = 20, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="app-bg3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#f1f5f9"/>
        </linearGradient>
        <linearGradient id="app-shield3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1"/>
          <stop offset="100%" stopColor="#8b5cf6"/>
        </linearGradient>
      </defs>

      {/* White rounded square background (rx=230, macOS standard) */}
      <rect width="1024" height="1024" rx="230" fill="url(#app-bg3)"/>

      {/* Filled shield */}
      <path d="M512 160 L820 280 L820 520 Q820 730 512 880 Q204 730 204 520 L204 280 Z"
            fill="url(#app-shield3)"/>

      {/* White </> code symbol */}
      <polyline points="400,440 310,512 400,584"
                fill="none" stroke="white" strokeWidth="64"
                strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="548" y1="416" x2="476" y2="608"
            stroke="white" strokeWidth="64" strokeLinecap="round"/>
      <polyline points="624,440 714,512 624,584"
                fill="none" stroke="white" strokeWidth="64"
                strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
