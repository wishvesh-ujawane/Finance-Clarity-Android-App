import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion';
import { ChevronDown, Share2 } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatMonthYear } from '@/lib/finance-utils';
import { getMonthKey, shiftMonth } from '@/lib/analysis-utils';
import OverviewPane from '@/components/analysis/OverviewPane';
import PlanningPane from '@/components/analysis/PlanningPane';
import TrendsPane from '@/components/analysis/TrendsPane';
import { useAnalysisShared } from '@/components/analysis/useAnalysisShared';

export default function Analysis() {
  const { selectedMonth, setSelectedMonth } = useFinance();
  const shared = useAnalysisShared();

  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const overviewRef = useRef<HTMLDivElement>(null);

  const TABS = useMemo(() => ['overview', 'planning', 'trends'] as const, []);
  type TabKey = typeof TABS[number];
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const activeIndex = TABS.indexOf(activeTab);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  const x = useMotionValue(0);
  const isDraggingRef = useRef(false);

  useLayoutEffect(() => {
    const update = () => {
      if (sliderRef.current) setPaneWidth(sliderRef.current.clientWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

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

  const currentMonthKey = useMemo(() => getMonthKey(new Date()), []);
  const monthPickerOptions = useMemo(() => {
    const options: string[] = [];
    for (let i = 0; i <= 12; i++) {
      options.push(shiftMonth(currentMonthKey, -i));
    }
    return options;
  }, [currentMonthKey]);

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

      const filename = `analysis-${selectedMonth}.png`;
      const isCapacitor = typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor !== 'undefined' &&
        (window as unknown as { Capacitor: { isNativePlatform?: () => boolean } }).Capacitor.isNativePlatform?.();

      if (isCapacitor) {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
          import('@capacitor/filesystem'),
          import('@capacitor/share'),
        ]);
        const base64 = dataUrl.split(',')[1];
        const written = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'Financial Analysis',
          text: `Analysis for ${formatMonthYear(selectedMonth)}`,
          url: written.uri,
          dialogTitle: 'Share analysis',
        });
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.click();
      }
    } catch (err) {
      console.error('Share failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Analytics</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Analysis</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="month-picker-trigger"
            onClick={() => setMonthPickerOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
            aria-label="Change month"
          >
            <div className="text-right">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">Month</p>
              <p className="text-sm font-bold text-foreground leading-tight">{formatMonthYear(selectedMonth)}</p>
            </div>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
          <button
            type="button"
            data-testid="analysis-share"
            onClick={handleShare}
            disabled={isExporting}
            className="w-9 h-9 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors flex items-center justify-center disabled:opacity-40"
            aria-label="Share Overview as image"
          >
            <Share2 size={15} />
          </button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="space-y-4">
        <TabsList className="w-full grid grid-cols-3 h-10">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <div ref={sliderRef} className="overflow-hidden touch-pan-y">
          <motion.div
            className="flex"
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
              className="space-y-4 align-top flex-shrink-0"
              style={{ width: paneWidth || undefined }}
              role="tabpanel"
              aria-hidden={activeTab !== 'overview'}
            >
              <OverviewPane ref={overviewRef} shared={shared} />
            </div>

            <div
              className="space-y-4 align-top flex-shrink-0"
              style={{ width: paneWidth || undefined }}
              role="tabpanel"
              aria-hidden={activeTab !== 'planning'}
            >
              <PlanningPane shared={shared} />
            </div>

            <div
              className="space-y-4 align-top flex-shrink-0"
              style={{ width: paneWidth || undefined }}
              role="tabpanel"
              aria-hidden={activeTab !== 'trends'}
            >
              <TrendsPane shared={shared} />
            </div>
          </motion.div>
        </div>
      </Tabs>

      {/* ─── Month picker bottom sheet ─── */}
      <Sheet open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-5 max-h-[60vh] overflow-y-auto">
          <SheetHeader className="text-left mb-3 pr-8">
            <SheetTitle className="text-base" style={{ fontFamily: 'var(--font-display)' }}>Select month</SheetTitle>
            <SheetDescription>Choose any of the last 13 months.</SheetDescription>
          </SheetHeader>
          <div className="space-y-1">
            {monthPickerOptions.map(m => {
              const isActive = m === selectedMonth;
              const isCurrent = m === currentMonthKey;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setSelectedMonth(m); setMonthPickerOpen(false); }}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors',
                    isActive ? 'bg-accent/10 border border-accent/40' : 'border border-transparent hover:bg-muted'
                  )}
                  data-testid={`month-option-${m}`}
                >
                  <span className={cn('text-sm font-semibold', isActive ? 'text-accent' : 'text-foreground')}>
                    {formatMonthYear(m)}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Current</span>
                  )}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
