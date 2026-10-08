import { FC, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localStorageGet, localStorageRemove, localStorageSet } from '../../services/storage/local-storage';

const TOUR_SEEN_KEY = 'webgui_tour_done_v1';

export const hasSeenTour = (): boolean => {
  try {
    return localStorageGet(TOUR_SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

export const markTourSeen = (): void => {
  try {
    localStorageSet(TOUR_SEEN_KEY, '1');
  } catch {
    // Ignore storage errors - the tour just shows again
  }
};

/** Forget that the tour was seen - the next render starts it again */
export const resetTourSeen = (): void => {
  try {
    localStorageRemove(TOUR_SEEN_KEY);
  } catch {
    // Ignore storage errors
  }
};

interface TourStep {
  /** data-tour attribute of the target element (desktop) */
  selector: string;
  /** Alternative target used on small screens (e.g. hamburger menu) */
  mobileSelector?: string;
  titleKey: string;
  textKey: string;
}

const STEPS: TourStep[] = [
  {
    selector: 'model-select',
    titleKey: 'tour.step1Title',
    textKey: 'tour.step1Text',
  },
  {
    selector: 'profile-select',
    titleKey: 'tour.step2Title',
    textKey: 'tour.step2Text',
  },
  {
    selector: 'export-import',
    titleKey: 'tour.step3Title',
    textKey: 'tour.step3Text',
  },
  {
    selector: 'search',
    titleKey: 'tour.step4Title',
    textKey: 'tour.step4Text',
  },
  {
    selector: 'message-input',
    titleKey: 'tour.step5Title',
    textKey: 'tour.step5Text',
  },
  {
    selector: 'sidebar-nav',
    mobileSelector: 'mobile-menu',
    titleKey: 'tour.step6Title',
    textKey: 'tour.step6Text',
  },
];

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface GuidedTourProps {
  /** Called when the tour is finished or skipped */
  onComplete: () => void;
}

/**
 * Step-by-step spotlight tour through the chat UI. Each step highlights one
 * element (via its data-tour attribute) with a dimmed backdrop and shows an
 * explanation card next to it. Steps whose target is not visible (e.g. the
 * desktop sidebar on phones) are skipped automatically.
 */
export const GuidedTour: FC<GuidedTourProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(180);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const findTarget = (step: TourStep): HTMLElement | null => {
    const selectors = [step.selector, step.mobileSelector].filter(Boolean) as string[];
    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(`[data-tour="${sel}"]`);
      // offsetParent is null for display:none elements - treat as invisible
      if (el && el.offsetParent !== null) {
        return el;
      }
    }
    return null;
  };

  useEffect(() => {
    let idx = stepIndex;
    let target: HTMLElement | null = null;

    // Skip steps whose target is not on screen
    while (idx < STEPS.length) {
      target = findTarget(STEPS[idx]);
      if (target) {
        break;
      }
      idx++;
    }
    if (idx >= STEPS.length || !target) {
      onComplete();
      return;
    }
    if (idx !== stepIndex) {
      setStepIndex(idx);
      return;
    }

    const updatePosition = (): void => {
      const r = target.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    updatePosition();
    // Re-measure after the smooth scroll settles
    const settleTimer = window.setTimeout(updatePosition, 400);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return (): void => {
      window.clearTimeout(settleTimer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [stepIndex, onComplete]);

  // Measure the tooltip so it can be placed without covering the highlight
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      setTooltipHeight(tooltipRef.current.offsetHeight);
    }
  }, [stepIndex, rect]);

  if (!rect) {
    return null;
  }

  const pad = 8;
  const hole = {
    top: Math.max(4, rect.top - pad),
    left: Math.max(4, rect.left - pad),
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  const tooltipWidth = 320;
  const maxLeft = Math.max(8, window.innerWidth - tooltipWidth - 16);
  const tooltipLeft = Math.min(Math.max(8, hole.left), maxLeft);
  const fitsBelow = hole.top + hole.height + 16 + tooltipHeight < window.innerHeight;
  const tooltipTop = fitsBelow
    ? hole.top + hole.height + 16
    : Math.max(16, hole.top - tooltipHeight - 16);

  const step = STEPS[stepIndex];
  const isLast = stepIndex >= STEPS.length - 1;

  const finish = (): void => {
    markTourSeen();
    onComplete();
  };

  const next = (): void => {
    if (isLast) {
      finish();
    } else {
      setRect(null);
      setStepIndex((i) => i + 1);
    }
  };

  const back = (): void => {
    setRect(null);
    setStepIndex((i) => Math.max(0, i - 1));
  };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label={t('tour.ariaLabel')}>
      {/* Spotlight: the huge box-shadow dims everything except the target */}
      <div
        className="absolute rounded-2xl border-2 border-indigo-400 dark:border-indigo-500 transition-all duration-300"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          boxShadow: '0 0 0 9999px rgba(24, 24, 27, 0.65)',
        }}
      />

      {/* Explanation card */}
      <div
        ref={tooltipRef}
        className="absolute w-[320px] max-w-[calc(100vw-24px)] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-4"
        style={{ top: tooltipTop, left: tooltipLeft }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-1">
          {t('tour.progress', { current: stepIndex + 1, total: STEPS.length })}
        </p>
        <h3 className="font-bold text-zinc-800 dark:text-zinc-100 mb-1.5">
          {t(step.titleKey)}
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
          {t(step.textKey)}
        </p>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={finish}
            className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 px-2 py-2 transition-colors"
          >
            {t('tour.skip')}
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={back}
                className="px-3 py-2 text-sm rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {t('tour.back')}
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:opacity-90 transition-opacity"
            >
              {isLast ? t('tour.finish') : t('tour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
