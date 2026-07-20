interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
}

const sizes = {
  sm: { icon: 'h-7 w-7', title: 'text-base', tagline: 'text-[10px]' },
  md: { icon: 'h-9 w-9', title: 'text-lg', tagline: 'text-xs' },
  lg: { icon: 'h-12 w-12', title: 'text-2xl sm:text-3xl', tagline: 'text-sm' },
}

export function Logo({ size = 'md', showTagline = false, className = '' }: LogoProps) {
  const s = sizes[size]

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`flex ${s.icon} shrink-0 items-center justify-center rounded-xl bg-pasture-800 text-white shadow-sm`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-[55%] w-[55%]">
          <path d="M4 14c0-2.5 1.8-4.5 4.2-5.1C7.5 6.8 9.5 5 12 5s4.5 1.8 4.8 3.9C19.2 9.5 21 11.5 21 14v2.5c0 .8-.7 1.5-1.5 1.5h-1.8a2.2 2.2 0 0 1-2.2-2.2V14a1 1 0 0 0-1-1h-1.2a1 1 0 0 0-1 1v2.8a2.2 2.2 0 0 1-2.2 2.2H8.7a2.2 2.2 0 0 1-2.2-2.2V14a1 1 0 0 0-1-1H4.5a1 1 0 0 0-1 1v2.8A2.2 2.2 0 0 1 1.3 20H1A1.5 1.5 0 0 1-.5 18.5V14z" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className={`font-display font-bold leading-tight text-pasture-900 ${s.title}`}>
          AgriTrack
        </p>
        {showTagline && (
          <p className={`leading-tight text-barn-600 ${s.tagline}`}>
            Smart farm management & tracking
          </p>
        )}
      </div>
    </div>
  )
}
