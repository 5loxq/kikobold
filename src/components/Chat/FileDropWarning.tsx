import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Drag & drop is not supported for attachments - dropped files would be
 * opened by the browser instead. This component intercepts file drags over
 * the window, prevents the default browser behavior and shows a warning
 * overlay pointing to the paperclip button instead.
 *
 * The overlay hides when no dragover event has arrived for a moment:
 * dragenter/dragleave do not always fire in pairs (e.g. when the user
 * releases the file outside the window), so a pure depth counter could
 * leave the overlay stuck forever.
 */
export const FileDropWarning: React.FC = () => {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let hideTimer: number | undefined;

    const hasFiles = (event: DragEvent): boolean =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');

    // dragover fires continuously (~every 100-350ms) while a drag is over
    // the window - it is the reliable "still dragging" signal.
    const onDragOver = (event: DragEvent): void => {
      if (!hasFiles(event)) {return;}
      // Prevent the browser from opening the file when it is dropped
      event.preventDefault();
      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }
      hideTimer = window.setTimeout(() => setDragging(false), 500);
      setDragging(true);
    };

    const onDrop = (event: DragEvent): void => {
      if (!hasFiles(event)) {return;}
      event.preventDefault();
      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }
      setDragging(false);
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);

    return (): void => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }
    };
  }, []);

  if (!dragging) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[65] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-none">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl max-w-md w-full border-2 border-dashed border-amber-400 dark:border-amber-600 p-8 text-center">
        <div className="text-4xl mb-3" aria-hidden="true">⚠️</div>
        <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-2">
          {t('attachments.dropWarningTitle')}
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          {t('attachments.dropWarningText')}
        </p>
      </div>
    </div>
  );
};
