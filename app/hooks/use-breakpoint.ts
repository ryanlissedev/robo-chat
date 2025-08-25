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
    if ('addEventListener' in mql && typeof (mql as any).addEventListener === 'function') {
      (mql as any).addEventListener('change', onChange);
    } else if ('addListener' in mql && typeof (mql as any).addListener === 'function') {
      (mql as any).addListener(onChange);
    }
    setIsBelowBreakpoint(window.innerWidth < breakpoint);
    return () => {
      if ('removeEventListener' in mql && typeof (mql as any).removeEventListener === 'function') {
        (mql as any).removeEventListener('change', onChange);
      } else if ('removeListener' in mql && typeof (mql as any).removeListener === 'function') {
        (mql as any).removeListener(onChange);
      }
    };
  }, [breakpoint]);

  return !!isBelowBreakpoint;
}
