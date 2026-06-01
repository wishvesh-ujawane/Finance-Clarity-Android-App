import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Wallet, ShieldCheck, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Slide {
  icon: LucideIcon;
  /** Tailwind class for the icon tile background (semi-transparent over the navy card). */
  iconBg: string;
  /** Tailwind class for the icon stroke colour. */
  iconColor: string;
  /** Tailwind class for the inner ambient glow blob. */
  glow: string;
  eyebrow: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: Wallet,
    iconBg: 'bg-emerald-400/15 ring-1 ring-emerald-400/30',
    iconColor: 'text-emerald-300',
    glow: 'bg-emerald-500/20',
    eyebrow: 'Welcome to Finance Clarity',
    title: 'Track every rupee, your way.',
    body: 'A fast, offline-first companion for daily spending, income and recurring bills — no account required to get started.',
  },
  {
    icon: ShieldCheck,
    iconBg: 'bg-sky-400/15 ring-1 ring-sky-400/30',
    iconColor: 'text-sky-300',
    glow: 'bg-sky-500/20',
    eyebrow: 'Private by design',
    title: 'Your data stays on your device.',
    body: 'Nothing leaves your phone unless you choose to back it up to your own Google Drive. You control your data — always.',
  },
  {
    icon: BarChart3,
    iconBg: 'bg-violet-400/15 ring-1 ring-violet-400/30',
    iconColor: 'text-violet-300',
    glow: 'bg-violet-500/20',
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
      className="flex h-full w-full flex-col bg-background"
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
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          data-testid="onboarding-skip"
          className="text-muted-foreground"
        >
          Skip
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-5">
        {/* Hero card — same visual language as Dashboard balance card */}
        <div
          key={index}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[hsl(222,65%,13%)] p-7 text-white shadow-xl shadow-black/20"
          data-testid="onboarding-hero"
        >
          {/* Decorative ambient circles, echoing the dashboard balance hero */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -right-6 -bottom-16 h-52 w-52 rounded-full bg-white/5" />
          <div className={cn('pointer-events-none absolute -left-12 -bottom-12 h-40 w-40 rounded-full blur-2xl', slide.glow)} />

          <div className="relative">
            {/* Step indicator inside the card, top-right */}
            <p className="absolute right-0 top-0 text-[11px] font-semibold text-white/40">
              {index + 1} / {SLIDES.length}
            </p>

            <div className={cn('mb-6 flex h-16 w-16 items-center justify-center rounded-2xl', slide.iconBg)}>
              <Icon className={cn('h-8 w-8', slide.iconColor)} strokeWidth={1.8} />
            </div>

            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">
              {slide.eyebrow}
            </p>
            <h2
              className="mb-3 text-2xl font-bold leading-tight sm:text-3xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {slide.title}
            </h2>
            <p className="text-sm leading-relaxed text-white/75 sm:text-base">
              {slide.body}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 pb-8 pt-6">
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
