import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    description: '5 files per session, no account required',
    features: [
      '5 files per browser session',
      'PDF, DOCX, XLSX, image support',
      'AI PII detection',
      'Black box & blur masking',
      'Client-side processing',
    ],
    cta: 'Get started free',
    href: '/',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/month',
    description: 'Unlimited files, profiles, and batch processing',
    features: [
      'Unlimited files',
      'Batch processing (up to 100 files)',
      'Redaction profiles',
      'Fake data replacement',
      'All masking styles',
      'Priority processing',
    ],
    cta: 'Start Pro trial',
    href: '/',
    highlight: true,
  },
  {
    name: 'Team',
    price: '$39',
    period: '/month',
    description: 'Shared profiles and team library',
    features: [
      'Everything in Pro',
      'Shared team profiles',
      'Team library sync',
      'Up to 10 members',
      'Admin dashboard',
    ],
    cta: 'Start Team trial',
    href: '/',
    highlight: false,
  },
];

export function Pricing() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-12 text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h1>
        <p className="text-muted-foreground">Start free. Upgrade when you need more.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={cn(
              'relative flex flex-col rounded-2xl p-6 space-y-5',
              plan.highlight
                ? 'bg-primary text-white shadow-[0_20px_25px_-5px_rgba(91,94,244,0.3),0_8px_10px_-6px_rgba(91,94,244,0.2)]'
                : 'border border-border bg-card'
            )}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-success px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                  Most popular
                </span>
              </div>
            )}

            <div>
              <p className={cn('font-semibold text-lg', plan.highlight ? 'text-white' : 'text-foreground')}>
                {plan.name}
              </p>
              <p className={cn('text-sm mt-0.5', plan.highlight ? 'text-white/70' : 'text-muted-foreground')}>
                {plan.description}
              </p>
            </div>

            <div className="flex items-baseline gap-0.5">
              <span className={cn('text-4xl font-bold', plan.highlight ? 'text-white' : 'text-foreground')}>
                {plan.price}
              </span>
              <span className={cn('text-sm', plan.highlight ? 'text-white/60' : 'text-muted-foreground')}>
                {plan.period}
              </span>
            </div>

            <ul className="flex-1 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check
                    className={cn('h-4 w-4 mt-0.5 shrink-0', plan.highlight ? 'text-white/80' : 'text-success')}
                  />
                  <span className={plan.highlight ? 'text-white/90' : 'text-foreground'}>{f}</span>
                </li>
              ))}
            </ul>

            <Button
              asChild
              className={cn(
                'w-full',
                plan.highlight
                  ? 'bg-white text-primary hover:bg-white/90 font-semibold'
                  : ''
              )}
              variant={plan.highlight ? 'outline' : 'outline'}
            >
              <Link to={plan.href}>{plan.cta}</Link>
            </Button>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        All plans include client-side processing. Your files never leave your device.
      </p>
    </div>
  );
}
