interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 24, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2L21 6.5V13C21 18 17.2 21.8 12 23.5C6.8 21.8 3 18 3 13V6.5L12 2Z"
        fill="currentColor"
      />
      <rect x="7" y="10.5" width="10" height="2.8" rx="1.1" fill="white" />
      <rect x="7" y="15.2" width="6.5" height="2.8" rx="1.1" fill="white" opacity="0.55" />
    </svg>
  );
}

export function LogoFull({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #5B5EF4 0%, #7C3AED 100%)',
          boxShadow: '0 4px 14px rgba(91,94,244,0.4)',
        }}
      >
        <LogoMark size={20} className="text-white" />
      </div>
      <span className="font-black text-[18px] tracking-tight leading-none select-none">
        <span className="text-foreground">Mask</span>
        <span
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(90deg, #5B5EF4, #EC4899)' }}
        >
          -R
        </span>
      </span>
    </div>
  );
}
