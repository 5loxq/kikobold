import { useEffect, useState } from 'react';

/**
 * Tracks whether dark mode is active by observing the `dark` class on
 * <html>. The theme service toggles that class for explicit light/dark
 * mode AND when the system preference changes while mode is 'system',
 * so a MutationObserver stays in sync in every case - without threading
 * a boolean through the component tree.
 */
export const useDarkMode = (): boolean => {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document === 'undefined' ? false : document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const html = document.documentElement;
    const update = (): void => {
      setIsDark(html.classList.contains('dark'));
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return (): void => {
      observer.disconnect();
    };
  }, []);

  return isDark;
};
