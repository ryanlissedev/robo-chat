// TypeScript declarations to fix library compatibility issues

// Fix React 19 compatibility with Framer Motion
declare module 'react' {
  namespace Jsx {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }

  // Add missing React types for Framer Motion compatibility
  interface ReactHTML {
    [key: string]: any;
  }

  type DetailedHTMLFactory<P extends HTMLAttributes<T>, T extends Element> = (
    props?: (ClassAttributes<T> & P) | null,
    ...children: ReactNode[]
  ) => DetailedReactHTMLElement<P, T>;

  interface HTMLAttributes<_T> {
    [key: string]: any;
  }

  interface ClassAttributes<_T> {
    [key: string]: any;
  }

  type ReactNode = any;
  type DetailedReactHTMLElement<_P, _T> = any;
}

// Fix Window interface for Framer Motion
declare global {
  interface Window {
    MotionHandoffAnimation?: any;
    MotionHandoffIsComplete?: any;
    MotionCancelOptimisedAnimation?: any;
    MotionCheckAppearSync?: any;
  }
}

// Fix Supabase SSR schema constraints
declare module '@supabase/ssr' {
  export function createBrowserClient<
    Database = any,
    _SchemaName extends string &
      keyof Database = 'public' extends keyof Database
      ? 'public'
      : string & keyof Database,
  >(supabaseUrl: string, supabaseKey: string, options?: any): any;

  export function createServerClient<
    Database = any,
    _SchemaName extends string &
      keyof Database = 'public' extends keyof Database
      ? 'public'
      : string & keyof Database,
  >(supabaseUrl: string, supabaseKey: string, options?: any): any;
}

// Fix Radix UI component props compatibility
// Fix all Radix UI component props compatibility issues
declare module '@radix-ui/react-label' {
  interface LabelProps extends React.ComponentPropsWithoutRef<'label'> {
    children?: React.ReactNode;
    htmlFor?: string;
    className?: string;
  }
}

declare module '@radix-ui/react-select' {
  interface SelectContentProps extends React.ComponentPropsWithoutRef<'div'> {
    children?: React.ReactNode;
    className?: string;
  }

  interface SelectItemProps extends React.ComponentPropsWithoutRef<'div'> {
    children?: React.ReactNode;
    value: string;
    className?: string;
  }

  interface SelectTriggerProps extends React.ComponentPropsWithoutRef<'button'> {
    children?: React.ReactNode;
    className?: string;
  }

  interface SelectValueProps extends React.ComponentPropsWithoutRef<'span'> {
    children?: React.ReactNode;
    className?: string;
  }
}

declare module '@radix-ui/react-switch' {
  interface SwitchProps extends React.ComponentPropsWithoutRef<'button'> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    id?: string;
    className?: string;
  }

  interface SwitchThumbProps extends React.ComponentPropsWithoutRef<'span'> {
    className?: string;
  }
}

declare module '@radix-ui/react-tooltip' {
  interface TooltipContentProps extends React.ComponentPropsWithoutRef<'div'> {
    children?: React.ReactNode;
    className?: string;
    sideOffset?: number;
  }

  interface TooltipTriggerProps extends React.ComponentPropsWithoutRef<'button'> {
    children?: React.ReactNode;
    className?: string;
    asChild?: boolean;
  }
}

declare module '@radix-ui/react-tabs' {
  interface TabsProps extends React.ComponentPropsWithoutRef<'div'> {
    children?: React.ReactNode;
    className?: string;
    defaultValue?: string;
    value?: string;
  }

  interface TabsListProps extends React.ComponentPropsWithoutRef<'div'> {
    children?: React.ReactNode;
    className?: string;
  }

  interface TabsTriggerProps extends React.ComponentPropsWithoutRef<'button'> {
    children?: React.ReactNode;
    className?: string;
    value: string;
  }

  interface TabsContentProps extends React.ComponentPropsWithoutRef<'div'> {
    children?: React.ReactNode;
    className?: string;
    value: string;
  }
}

declare module '@radix-ui/react-slider' {
  interface SliderProps extends React.ComponentPropsWithoutRef<'span'> {
    children?: React.ReactNode;
    className?: string;
    value?: number[];
    onValueChange?: (value: number[]) => void;
    max?: number;
    min?: number;
    step?: number;
  }

  interface SliderTrackProps extends React.ComponentPropsWithoutRef<'span'> {
    children?: React.ReactNode;
    className?: string;
  }

  interface SliderRangeProps extends React.ComponentPropsWithoutRef<'span'> {
    className?: string;
  }

  interface SliderThumbProps extends React.ComponentPropsWithoutRef<'span'> {
    className?: string;
  }
}

declare module '@radix-ui/react-separator' {
  interface SeparatorProps extends React.ComponentPropsWithoutRef<'div'> {
    className?: string;
    orientation?: 'horizontal' | 'vertical';
    decorative?: boolean;
  }
}

// Export to ensure this is treated as a module
export {};
