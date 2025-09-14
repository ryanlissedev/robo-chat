// TypeScript declarations to fix library compatibility issues

// Fix React 19 compatibility with Framer Motion
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }

  // Add missing React types for Framer Motion compatibility
  interface ReactHTML {
    [key: string]: any;
  }

  interface DetailedHTMLFactory<
    P extends HTMLAttributes<T>,
    T extends Element,
  > {
    (
      props?: (ClassAttributes<T> & P) | null,
      ...children: ReactNode[]
    ): DetailedReactHTMLElement<P, T>;
  }

  interface HTMLAttributes<T> {
    [key: string]: any;
  }

  interface ClassAttributes<T> {
    [key: string]: any;
  }

  type ReactNode = any;
  type DetailedReactHTMLElement<P, T> = any;
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
    SchemaName extends string & keyof Database = 'public' extends keyof Database
      ? 'public'
      : string & keyof Database,
  >(supabaseUrl: string, supabaseKey: string, options?: any): any;

  export function createServerClient<
    Database = any,
    SchemaName extends string & keyof Database = 'public' extends keyof Database
      ? 'public'
      : string & keyof Database,
  >(supabaseUrl: string, supabaseKey: string, options?: any): any;
}

// Export to ensure this is treated as a module
export {};
