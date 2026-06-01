import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { Wallet, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GoogleDriveIcon } from '@/components/icons/GoogleDriveIcon';
import { cn } from '@/lib/utils';

type SlideIcon = ComponentType<SVGProps<SVGSVGElement>>;

interface Slide {
  Icon: SlideIcon;
  /** Tailwind class for the icon tile background. */
  iconBg: string;
  /** Tailwind class for the icon stroke colour (lucide only). */
  iconColor?: string;
  /** Tailwind class for the soft ambient glow. */
  glow: string;
  eyebrow: string;
  title: string;
  body: string;
  /** When true, render the icon at its native colour without a tint class. */
  iconNative?: boolean;
}

const SLIDES: Slide[] = [
  {
    Icon: Wallet,
    iconBg: 'bg-emerald-400/15 ring-1 ring-emerald-400/30',
    iconColor: 'text-emerald-300',
    glow: 'bg-emerald-500/25',
    eyebrow: 'Welcome to Finance Clarity',
    title: 'Track every rupee, your way.',
    body: 'A fast, offline-first companion for daily spending, income and recurring bills — no account required to get started.',
  },
  {
    Icon: ShieldCheck,
    iconBg: 'bg-sky-400/15 ring-1 ring-sky-400/30',
    iconColor: 'text-sky-300',
    glow: 'bg-sky-500/25',
    eyebrow: 'Private by design',
    title: 'Your data stays on your device.',
    body: 'Nothing leaves your phone unless you choose to back it up to your own Google Drive. You control your data — always.',
  },
  {
    Icon: GoogleDriveIcon,
    iconBg: 'bg-white/10 ring-1 ring-white/20',
    glow: 'bg-amber-400/20',
    eyebrow: 'Backup, restore, switch devices',
    title: 'Carry your data with Google Drive.',
    body: 'Sign in with Google and your encrypted backup lives in your own Drive — restore it anytime, on any device.',
    iconNative: true,
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
  const { Icon } = slide;

  // Basic swipe support; lightweight for this single-use UI.
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
      key={index}
      className="relative flex h-full w-full flex-col overflow-hidden bg-[hsl(222,65%,13%)] text-white"
      onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (dx < -50) next();
        else if (dx > 50) back();
        setTouchStartX(null);
      }}
    >
      {/* Full-screen decorative background — same language as the Dashboard hero */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.04]" />
      <div className="pointer-events-none absolute -right-10 top-32 h-96 w-96 rounded-full bg-white/[0.03]" />
      <div className="pointer-events-none absolute -left-28 -bottom-24 h-80 w-80 rounded-full bg-white/[0.04]" />
      <div
        className={cn(
          'pointer-events-none absolute -left-16 top-1/3 h-72 w-72 rounded-full blur-3xl transition-colors duration-500',
          slide.glow,
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute right-1/4 -bottom-20 h-64 w-64 rounded-full blur-3xl opacity-60 transition-colors duration-500',
          slide.glow,
        )}
      />

      {/* Top bar: step indicator + Skip */}
      <div className="relative flex items-center justify-between px-6 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
          {String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          data-testid="onboarding-skip"
          className="text-white/70 hover:bg-white/10 hover:text-white"
        >
          Skip
        </Button>
      </div>

      {/* Centered content */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div
          className={cn(
            'mb-8 flex h-24 w-24 items-center justify-center rounded-3xl shadow-lg shadow-black/30',
            slide.iconBg,
          )}
        >
          <Icon
            className={cn('h-12 w-12', !slide.iconNative && slide.iconColor)}
            {...(!slide.iconNative ? { strokeWidth: 1.8 } : {})}
          />
        </div>

        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
          {slide.eyebrow}
        </p>
        <h2
          className="mb-4 max-w-md text-3xl font-bold leading-tight sm:text-4xl"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {slide.title}
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
          {slide.body}
        </p>
      </div>

      {/* Footer: dots + Back / Next */}
      <div className="relative px-6 pb-10">
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
                i === index ? 'w-8 bg-white' : 'w-2 bg-white/25',
              )}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={back}
            disabled={index === 0}
            className="min-w-20 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30"
          >
            Back
          </Button>
          <Button
            onClick={next}
            size="lg"
            className="min-w-36 bg-white text-[hsl(222,65%,13%)] hover:bg-white/90"
            data-testid="onboarding-next"
          >
            {isLast ? 'Get started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
