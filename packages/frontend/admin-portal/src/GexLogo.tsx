export function GexLogo({ size = 48, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="gexGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F0D478" />
          <stop offset="40%" stopColor="#D4A843" />
          <stop offset="100%" stopColor="#B8922E" />
        </linearGradient>
        <linearGradient id="gexShine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFE8A0" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#D4A843" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Outer ring */}
      <circle cx="60" cy="60" r="56" stroke="url(#gexGold)" strokeWidth="3" fill="none" />
      {/* Inner gift box shape */}
      <rect x="32" y="42" width="56" height="44" rx="6" fill="url(#gexGold)" opacity="0.15" />
      {/* Ribbon vertical */}
      <rect x="57" y="42" width="6" height="44" fill="url(#gexGold)" opacity="0.4" />
      {/* Ribbon horizontal */}
      <rect x="32" y="58" width="56" height="6" fill="url(#gexGold)" opacity="0.4" />
      {/* Bow left */}
      <path d="M60 58 C50 48, 34 44, 42 38 C50 32, 56 42, 60 52" fill="url(#gexGold)" opacity="0.6" />
      {/* Bow right */}
      <path d="M60 58 C70 48, 86 44, 78 38 C70 32, 64 42, 60 52" fill="url(#gexGold)" opacity="0.6" />
      {/* G letter */}
      <text x="60" y="72" textAnchor="middle" fontFamily="'Playfair Display', Georgia, serif" fontSize="36" fontWeight="900" fill="url(#gexGold)">G</text>
      {/* Shine accent */}
      <circle cx="60" cy="60" r="54" stroke="url(#gexShine)" strokeWidth="1" fill="none" />
      {/* Star sparkle top-right */}
      <circle cx="92" cy="28" r="2" fill="#F0D478" opacity="0.8" />
      <circle cx="96" cy="22" r="1.2" fill="#F0D478" opacity="0.5" />
      <circle cx="28" cy="90" r="1.5" fill="#F0D478" opacity="0.4" />
    </svg>
  );
}