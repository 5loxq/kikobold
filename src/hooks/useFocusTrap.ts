import { type RefObject, useEffect, useRef } from 'react';


/**
 * Focus trap for modal dialogs (WCAG 2.4.3 "focus order"):
 * - moves the focus into the dialog when it opens
 * - keeps Tab/Shift+Tab inside the dialog
 * - Escape calls `onClose`
 * - returns the focus to the previously focused element on close
 *
 * Returns a ref that must be attached to the dialog's outermost container.
 */
export const useFocusTrap = (
  active: boolean,
  onClose?: () => void
): RefObject<HTMLDivElement> => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) {
      return;
    }
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const getFocusable = (): HTMLElement[] => {
      // Read the ref on every call: dialog content may render asynchronously
      // (e.g. after data loads), when the effect has already run.
      const container = containerRef.current;
      if (!container) {
        return [];
      }
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      // offsetParent is null for position:fixed elements (many dialogs are
      // fixed), so use checkVisibility where available and only fall back
      // to the offsetParent heuristic.
      ).filter((el) => (typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.offsetParent !== null));
    };

    // Move the focus into the dialog
    const focusables = getFocusable();
    if (focusables.length > 0) {
      focusables[0].focus();
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') {
        return;
      }
      const list = getFocusable();
      if (list.length === 0) {
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const currentContainer = containerRef.current;
      if (e.shiftKey && (document.activeElement === first || !currentContainer?.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !currentContainer?.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return (): void => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [active]);

  return containerRef;
};
