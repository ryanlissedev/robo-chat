import * as React from 'react';

export function useBreakpoint(breakpoint: number) {
  const [isBelowBreakpoint, setIsBelowBreakpoint] = React.useState<
    boolean | undefined
  >(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => {
      setIsBelowBreakpoint(window.innerWidth < breakpoint);
    };

    // Modern browsers support addEventListener
    if ('addEventListener' in mql) {
      mql.addEventListener('change', onChange);
    } else {
      // Legacy fallback for older browsers
      (
        mql as MediaQueryList & { addListener?: (listener: () => void) => void }
      ).addListener?.(onChange);
    }

    setIsBelowBreakpoint(window.innerWidth < breakpoint);

    return () => {
      if ('removeEventListener' in mql) {
        mql.removeEventListener('change', onChange);
      } else {
        // Legacy fallback for older browsers
        (
          mql as MediaQueryList & {
            removeListener?: (listener: () => void) => void;
          }
        ).removeListener?.(onChange);
      }
    };
  }, [breakpoint]);

  return !!isBelowBreakpoint;
}
