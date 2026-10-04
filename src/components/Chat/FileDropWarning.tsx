import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Drag & drop is not supported for attachments - dropped files would be
 * opened by the browser instead. This component intercepts file drags over
 * the window, prevents the default browser behavior and shows a warning
 * overlay pointing to the paperclip button instead.
 */
export const FileDropWarning: React.FC = () => {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let dragDepth = 0;
    let hideTimer: number | undefined;

    const hasFiles = (event: DragEvent): boolean =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files');

    const onDragEnter = (event: DragEvent): void => {
      if (!hasFiles(event)) {return;}
      event.preventDefault();
      dragDepth++;
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = undefined;
      }
      setDragging(true);
    };

    const onDragOver = (event: DragEvent): void => {
      if (!hasFiles(event)) {return;}
      // Prevent the browser from opening the file when it is dropped
      event.preventDefault();
    };

    const onDragLeave = (event: DragEvent): void => {
      if (!hasFiles(event)) {return;}
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        // Small delay so the overlay does not flicker between elements
        hideTimer = window.setTimeout(() => setDragging(false), 150);
      }
    };

    const onDrop = (event: DragEvent): void => {
      if (!hasFiles(event)) {return;}
      event.preventDefault();
      dragDepth = 0;
      setDragging(false);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
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
