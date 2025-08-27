import * as React from 'react';

// const MOBILE_BREAKPOINT = 768; // Kept for potential future use
const MOBILE_QUERY = '(max-width: 767.98px)';

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined
  );
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setIsMobile(false);
      return;
    }
    const mql = window.matchMedia(MOBILE_QUERY);

    const onChange = () => {
      setIsMobile(mql.matches);
    };

    // Initialize from media query match state
    setIsMobile(mql.matches);

    // Modern browsers
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => {
        if (typeof mql.removeEventListener === 'function') {
          mql.removeEventListener('change', onChange);
        }
      };
    }

    // Legacy browsers fallback
    const legacyMql = mql as unknown as {
      addListener?: (listener: (e: unknown) => void) => void;
      removeListener?: (listener: (e: unknown) => void) => void;
    };
    if (typeof legacyMql.addListener === 'function') {
      legacyMql.addListener(onChange);
      return () => {
        if (typeof legacyMql.removeListener === 'function') {
          legacyMql.removeListener(onChange);
        }
      };
    }

    // If no listener APIs available, do nothing but avoid throwing
    return () => {};
  }, []);

  return !!isMobile;
}

// Backward-compatible export used by existing tests and components
export const useMobile = useIsMobile;
