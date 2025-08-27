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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mql as any).addListener?.(onChange);
    }

    setIsBelowBreakpoint(window.innerWidth < breakpoint);

    return () => {
      if ('removeEventListener' in mql) {
        mql.removeEventListener('change', onChange);
      } else {
        // Legacy fallback for older browsers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mql as any).removeListener?.(onChange);
      }
    };
  }, [breakpoint]);

  return !!isBelowBreakpoint;
}
