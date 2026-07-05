import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface ConfettiProps {
  /** Bump this to (re-)fire a burst. Same value = no re-fire. */
  fireKey: number | string;
  /** Number of particles per burst. */
  count?: number;
  /** Optional palette override. Defaults to the app's accent-friendly hues. */
  colors?: string[];
}

const DEFAULT_COLORS = ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#3B82F6', '#F97316'];

interface Particle {
  x: number;
  y: number;
  rotate: number;
  color: string;
  width: number;
  height: number;
  delay: number;
  duration: number;
}

function createParticles(count: number, colors: string[]): Particle[] {
  const list: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Angle out of a top-center point over the full upper hemisphere.
    const angle = (Math.PI * (0.15 + Math.random() * 0.7)); // 27° → 153°
    const velocity = 120 + Math.random() * 140;
    list.push({
      x: Math.cos(angle) * velocity * (Math.random() < 0.5 ? -1 : 1),
      y: 60 + Math.random() * 180,
      rotate: (Math.random() - 0.5) * 720,
      color: colors[i % colors.length],
      width: 6 + Math.round(Math.random() * 6),
      height: 10 + Math.round(Math.random() * 6),
      delay: Math.random() * 0.05,
      duration: 0.75 + Math.random() * 0.35,
    });
  }
  return list;
}

/**
 * Lightweight framer-motion confetti burst — no new dependency.
 * Respects prefers-reduced-motion (renders nothing in that case).
 * Positioned as a fixed, top-centered overlay above the modal but below
 * interactive controls (via pointer-events: none).
 */
export function Confetti({ fireKey, count = 28, colors = DEFAULT_COLORS }: ConfettiProps) {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);

  const particles = useMemo(() => createParticles(count, colors), [count, colors]);

  useEffect(() => {
    if (reduce) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 1200);
    return () => window.clearTimeout(t);
  }, [fireKey, reduce]);

  if (reduce || !visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] flex justify-center"
      data-testid="month-end-confetti"
    >
      <div className="relative h-0 w-0" style={{ top: '18%' }}>
        {particles.map((p, i) => (
          <motion.span
            key={`${fireKey}-${i}`}
            initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
            animate={{ opacity: 0, x: p.x, y: p.y, rotate: p.rotate }}
            transition={{ duration: p.duration, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              backgroundColor: p.color,
              width: p.width,
              height: p.height,
              borderRadius: 2,
              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
