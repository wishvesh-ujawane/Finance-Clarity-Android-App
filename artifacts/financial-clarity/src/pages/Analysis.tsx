import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion';
import { Share2 } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatMonthYear } from '@/lib/finance-utils';
import OverviewPane from '@/components/analysis/OverviewPane';
import PlanningPane from '@/components/analysis/PlanningPane';
import TrendsPane from '@/components/analysis/TrendsPane';
import { useAnalysisShared } from '@/components/analysis/useAnalysisShared';
import { PeriodSelector } from '@/components/PeriodSelector';
import { shareImage } from '@/lib/platform/share-image';
import { toast } from '@/hooks/use-toast';

/** DESIGN G16 / API §6.6: a failed share is shown, not only logged. */
function showShareFailure() {
  toast({
    variant: 'destructive',
    title: 'Couldn\u2019t share the image',
    description: 'The Overview image couldn\u2019t be created or shared. Your data is unchanged. Try again.',
  });
}

export default function Analysis() {
  const { selectedMonth } = useFinance();
  const shared = useAnalysisShared();

  const [isExporting, setIsExporting] = useState(false);
  const overviewRef = useRef<HTMLDivElement>(null);

  const TABS = useMemo(() => ['overview', 'planning', 'trends'] as const, []);
  type TabKey = typeof TABS[number];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const activeIndex = TABS.indexOf(activeTab);
  const sliderRef = useRef<HTMLDivElement>(null);
  const paneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [paneWidth, setPaneWidth] = useState(0);
  const [paneHeight, setPaneHeight] = useState<number | undefined>(undefined);
  const x = useMotionValue(0);
  const isDraggingRef = useRef(false);

  // Track the slider's own width (not only window resizes) so panes stay
  // aligned with the visible area.
  useLayoutEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    const update = () => setPaneWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The slider is only as tall as the active pane. Otherwise the row takes the
  // height of the longest pane and shorter tabs scroll into empty space.
  useLayoutEffect(() => {
    const el = paneRefs.current[activeIndex];
    if (!el) return;
    const update = () => setPaneHeight(el.offsetHeight);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeIndex]);

  // Programmatic snap on tab change / width change (skipped while dragging).
  useEffect(() => {
    if (isDraggingRef.current || paneWidth === 0) return;
    const target = -activeIndex * paneWidth;
    const controls = animate(x, target, {
      type: 'spring',
      stiffness: 260,
      damping: 30,
      mass: 0.9,
    });
    return () => controls.stop();
  }, [activeIndex, paneWidth, x]);

  const onPaneDragEnd = (_: unknown, info: PanInfo) => {
    isDraggingRef.current = false;
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    const offsetThreshold = paneWidth * 0.25;
    const velocityThreshold = 500;

    let dir = 0;
    if (velocity < -velocityThreshold || offset < -offsetThreshold) dir = 1;
    else if (velocity > velocityThreshold || offset > offsetThreshold) dir = -1;

    const next = Math.max(0, Math.min(TABS.length - 1, activeIndex + dir));
    if (next !== activeIndex) {
      setActiveTab(TABS[next]);
    } else {
      animate(x, -activeIndex * paneWidth, {
        type: 'spring',
        stiffness: 260,
        damping: 30,
        mass: 0.9,
      });
    }
  };

  const handleShare = async () => {
    if (!overviewRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(overviewRef.current, {
        cacheBust: true,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--background') || '#ffffff',
        pixelRatio: 2,
      });
      const result = await shareImage(dataUrl, `analysis-${selectedMonth}.png`, `Analysis for ${formatMonthYear(selectedMonth)}`);
      if (!result.ok && result.error === 'failed') showShareFailure();
    } catch {
      // The image could not be rendered.
      showShareFailure();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Analytics</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Analysis</h1>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector />
          <button
            type="button"
            data-testid="analysis-share"
            onClick={handleShare}
            disabled={isExporting}
            className="tap-target flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted/60 disabled:opacity-40"
            aria-label="Share Overview as image"
          >
            <Share2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <div
          ref={sliderRef}
          className="overflow-hidden touch-pan-y transition-[height] duration-200 ease-out"
          style={{ height: paneHeight }}
        >
          <motion.div
            className="flex items-start"
            style={{ x, width: paneWidth ? paneWidth * TABS.length : undefined }}
            drag={paneWidth > 0 ? 'x' : false}
            dragDirectionLock
            dragMomentum={false}
            dragElastic={0.08}
            dragConstraints={{ left: -(TABS.length - 1) * paneWidth, right: 0 }}
            onDragStart={() => { isDraggingRef.current = true; }}
            onDragEnd={onPaneDragEnd}
          >
            <div
              ref={el => { paneRefs.current[0] = el; }}
              className="space-y-4 flex-shrink-0"
              style={{ width: paneWidth || undefined }}
              role="tabpanel"
              aria-hidden={activeTab !== 'overview'}
            >
              <OverviewPane ref={overviewRef} shared={shared} />
            </div>

            <div
              ref={el => { paneRefs.current[1] = el; }}
              className="space-y-4 flex-shrink-0"
              style={{ width: paneWidth || undefined }}
              role="tabpanel"
              aria-hidden={activeTab !== 'planning'}
            >
              <PlanningPane shared={shared} />
            </div>

            <div
              ref={el => { paneRefs.current[2] = el; }}
              className="space-y-4 flex-shrink-0"
              style={{ width: paneWidth || undefined }}
              role="tabpanel"
              aria-hidden={activeTab !== 'trends'}
            >
              <TrendsPane shared={shared} />
            </div>
          </motion.div>
        </div>
      </Tabs>

    </div>
  );
}
