import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Wallet, ShieldCheck, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Slide {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  eyebrow: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: Wallet,
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-500',
    eyebrow: 'Welcome to Finance Clarity',
    title: 'Track every rupee, your way.',
    body: 'A fast, offline-first companion for daily spending, income and recurring bills — no account required to get started.',
  },
  {
    icon: ShieldCheck,
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-500',
    eyebrow: 'Private by design',
    title: 'Your data stays on your device.',
    body: 'Nothing leaves your phone unless you choose to back it up to your own Google Drive. You control your data — always.',
  },
  {
    icon: BarChart3,
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-500',
    eyebrow: 'Plan, save, understand',
    title: 'Budgets, goals and insights.',
    body: 'Set monthly budgets, work towards savings goals, and see where your money goes with clear monthly analysis.',
  },
];

interface IntroCarouselProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function IntroCarousel({ onComplete, onSkip }: IntroCarouselProps) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  const Icon = slide.icon;

  // Basic swipe support without pulling in embla wrapper for this single-use UI.
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, SLIDES.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const next = () => {
    if (isLast) onComplete();
    else setIndex(i => i + 1);
  };
  const back = () => setIndex(i => Math.max(i - 1, 0));

  return (
    <div
      className="flex h-full w-full flex-col"
      onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (dx < -50) next();
        else if (dx > 50) back();
        setTouchStartX(null);
      }}
    >
      <div className="flex justify-end p-4">
        <Button variant="ghost" size="sm" onClick={onSkip} data-testid="onboarding-skip">
          Skip
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className={cn('mb-8 flex h-24 w-24 items-center justify-center rounded-3xl', slide.iconBg)}>
          <Icon className={cn('h-12 w-12', slide.iconColor)} strokeWidth={1.8} />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {slide.eyebrow}
        </p>
        <h2
          className="mb-4 max-w-md text-2xl font-bold text-foreground sm:text-3xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {slide.title}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground sm:text-base">
          {slide.body}
        </p>
      </div>

      <div className="px-6 pb-8">
        <div className="mb-6 flex justify-center gap-2" role="tablist" aria-label="Intro slides">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                'h-2 rounded-full transition-all',
                i === index ? 'w-8 bg-primary' : 'w-2 bg-muted-foreground/30',
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={back}
            disabled={index === 0}
            className="min-w-20"
          >
            Back
          </Button>
          <Button
            onClick={next}
            size="lg"
            className="min-w-32"
            data-testid="onboarding-next"
          >
            {isLast ? 'Get started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
