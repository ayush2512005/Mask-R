import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    description: '5 files per session, no account required',
    features: ['5 files per browser session', 'PDF, DOCX, XLSX, image support', 'AI PII detection', 'Black box & blur masking', 'Client-side processing'],
    cta: 'Get started free',
    href: '/',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/month',
    description: 'Unlimited files, profiles, and batch processing',
    features: ['Unlimited files', 'Batch processing (up to 100 files)', 'Redaction profiles', 'Fake data replacement', 'All masking styles', 'Priority processing'],
    cta: 'Start Pro trial',
    href: '/',
    highlight: true,
  },
  {
    name: 'Team',
    price: '$39',
    period: '/month',
    description: 'Shared profiles and team library',
    features: ['Everything in Pro', 'Shared team profiles', 'Team library sync', 'Up to 10 members', 'Admin dashboard'],
    cta: 'Start Team trial',
    href: '/',
    highlight: false,
  },
];

export function Pricing() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h1>
        <p className="text-muted-foreground mt-2">Start free. Upgrade when you need more.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-6 space-y-5 ${plan.highlight ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
          >
            <div>
              <p className="font-semibold text-lg">{plan.name}</p>
              <p className="text-muted-foreground text-sm mt-0.5">{plan.description}</p>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-3xl font-bold">{plan.price}</span>
              <span className="text-muted-foreground text-sm">{plan.period}</span>
            </div>
            <ul className="space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Button asChild className="w-full" variant={plan.highlight ? 'default' : 'outline'}>
              <Link to={plan.href}>{plan.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
