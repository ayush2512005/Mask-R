import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { cn } from '@/lib/utils';
import { LogoFull } from '@/components/brand/Logo';
import { FileText, ImageIcon, Video, Monitor } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/docs',         label: 'Docs',         icon: FileText },
  { to: '/image',        label: 'Images',        icon: ImageIcon },
  { to: '/video',        label: 'Video',         icon: Video },
  { to: '/screen-guard', label: 'Screen Guard',  icon: Monitor },
];

function NavLink({ to, children }: { to: string; children: ReactNode }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== '/' && pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={cn(
        'relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150',
        active
          ? 'bg-primary/10 text-primary shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/60'
      )}
    >
      {children}
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-gradient-to-r from-primary to-violet" />
      )}
    </Link>
  );
}

export function Header() {
  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderColor: 'rgba(226,225,240,0.8)',
        boxShadow: '0 1px 20px rgba(91,94,244,0.06)',
      }}
    >
      <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">
        {/* Logo */}
        <Link to="/" aria-label="Home">
          <LogoFull />
        </Link>

        {/* Nav — pill container */}
        <nav
          className="hidden md:flex items-center gap-0.5 rounded-xl px-2 py-1.5"
          style={{
            background: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(226,225,240,0.9)',
            boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
          }}
        >
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Badge */}
        <div
          className="flex items-center gap-2 rounded-full px-3.5 py-1.5"
          style={{
            background: 'linear-gradient(135deg, rgba(91,94,244,0.12), rgba(124,58,237,0.12))',
            border: '1px solid rgba(91,94,244,0.2)',
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
          <span className="text-[11px] font-bold text-primary tracking-wide">FREE PLAN</span>
        </div>
      </div>
    </header>
  );
}
