interface Props {
  size?: number
  className?: string
}

/**
 * Code Reviewer app icon — white background + eye + </> code symbol
 * Matches icon-temp.png style: pointed eye shape + filled </> brackets
 */
export function CodeReviewerIcon({ size = 20, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="eye-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8"/>
          <stop offset="100%" stopColor="#a78bfa"/>
        </linearGradient>
        <linearGradient id="code-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa"/>
          <stop offset="100%" stopColor="#c084fc"/>
        </linearGradient>
      </defs>
      {/* White rounded square background */}
      <rect width="24" height="24" rx="5.3" fill="white"/>
      {/* Eye outline — pointed ends */}
      <path d="M1.5 12 Q6 5.5 12 5.5 Q18 5.5 22.5 12 Q18 18.5 12 18.5 Q6 18.5 1.5 12 Z"
            fill="none" stroke="url(#eye-g)" strokeWidth="1.3" strokeLinejoin="round"/>
      {/* Iris */}
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="url(#eye-g)" strokeWidth="1.2"/>
      {/* < bracket filled */}
      <path d="M9.8 8.8 L7 12 L9.8 15.2 L9.8 13.8 L8.4 12 L9.8 10.2 Z" fill="url(#code-g)"/>
      {/* > bracket filled */}
      <path d="M14.2 8.8 L17 12 L14.2 15.2 L14.2 13.8 L15.6 12 L14.2 10.2 Z" fill="url(#code-g)"/>
      {/* / slash */}
      <rect x="11.2" y="8.5" width="1.6" height="7" rx="0.8" fill="url(#code-g)"
            transform="rotate(-15 12 12)"/>
    </svg>
  )
}
