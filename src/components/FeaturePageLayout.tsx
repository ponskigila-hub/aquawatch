import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Waves } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppNavigation } from '@/components/AppNavigation';

interface FeaturePageLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  updatedAt?: string;
}

export const FeaturePageLayout = ({ eyebrow, title, description, children, updatedAt }: FeaturePageLayoutProps) => (
  <div className="weather-shell min-h-screen">
    <header className="sticky top-0 z-30 border-b bg-card/90 shadow-sm backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground"><Waves className="h-5 w-5" /></span>
          <span className="min-w-0"><span className="block truncate text-sm font-bold">AquaWatch</span><span className="hidden text-[11px] text-muted-foreground sm:block">Environmental monitoring</span></span>
        </Link>
        <div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">{updatedAt ?? 'Live sources · varies by layer'}</span><ThemeToggle /></div>
      </div>
      <AppNavigation />
    </header>
    <main className="container mx-auto space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
      <div className="max-w-4xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
      </div>
      {children}
    </main>
    <footer className="mt-10 border-t bg-card/50 py-5 text-center text-xs text-muted-foreground">AquaWatch · Data timing and coverage vary by source · Not an official emergency-warning service</footer>
  </div>
);
