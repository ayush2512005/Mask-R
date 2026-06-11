import { Link } from 'react-router';
import { Shield } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <Shield className="h-5 w-5 text-primary" />
          <span>Redact</span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link to="/batch" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Batch
          </Link>
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </Link>
        </nav>
      </div>
    </header>
  );
}
