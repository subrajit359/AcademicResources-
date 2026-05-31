import { useEffect } from 'react';

/**
 * Locks body scroll while the calling component is mounted.
 * Uses the position:fixed trick so it works on iOS Safari too.
 * Uses a counter so multiple simultaneous modals don't fight each other.
 */
let lockCount = 0;
let savedScrollY = 0;

export function useScrollLock() {
  useEffect(() => {
    lockCount++;
    if (lockCount === 1) {
      savedScrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.width = '100%';
    }
    return () => {
      lockCount--;
      if (lockCount <= 0) {
        lockCount = 0;
        const y = savedScrollY;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, y);
      }
    };
  }, []);
}
