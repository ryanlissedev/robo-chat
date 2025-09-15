import type { SVGProps } from 'react';
import {
  type LayoutType,
  useUserPreferences,
} from '@/lib/user-preference-store/provider';
import { cn } from '@/lib/utils';

const LayoutSidebar = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      height={578}
      viewBox="0 0 1028 578"
      width={1028}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Sidebar Layout"
      {...props}
    >
      <title>Sidebar Layout</title>
      <g clipPath="url(#layout-sidebar)">
        {/* Main background */}
        <path d="M0 0h1028v578H0z" strokeWidth={1} />
        {/* Main content area */}
        <path
          d="M177 86c0-8.836 7.163-16 16-16h638c8.837 0 16 7.163 16 16v405c0 8.837-7.163 16-16 16H193c-8.837 0-16-7.163-16-16z"
          stroke="var(--border)"
          strokeWidth={2}
        />
        {/* Border details for main content area */}
        <path
          d="M193 70v1h638v-2H193zm654 16h-1v405h2V86zm-16 421v-1H193v2h638zm-654-16h1V86h-2v405zm16 16v-1c-8.284 0-15-6.716-15-15h-2c0 9.389 7.611 17 17 17zm654-16h-1c0 8.284-6.716 15-15 15v2c9.389 0 17-7.611 17-17zM831 70v1c8.284 0 15 6.716 15 15h2c0-9.389-7.611-17-17-17zm-638 0v-1c-9.389 0-17 7.611-17 17h2c0-8.284 6.716-15 15-15z"
          fill="var(--background)"
          mask="url(#b)"
        />
        {/* Bottom content box */}
        <rect
          fill="var(--secondary)"
          height={72}
          rx={16}
          stroke="var(--border)"
          strokeWidth={1}
          width={369}
          x={398}
          y={411}
        />
        {/* Middle content box */}
        <rect
          fill="var(--secondary)"
          height={69}
          rx={8}
          stroke="var(--border)"
          strokeWidth={1}
          width={214.628}
          x={398}
          y={294}
        />
        {/* Text content in middle box */}
        <path
          d="M588.758 318H421.871c-1.713 0-3.1 1.791-3.1 4s1.387 4 3.1 4h166.887c1.712 0 3.1-1.791 3.1-4s-1.388-4-3.1-4M568.359 330h-146.86c-1.507 0-2.728 2.015-2.728 4.5s1.221 4.5 2.728 4.5h146.86c1.507 0 2.728-2.015 2.728-4.5s-1.221-4.5-2.728-4.5"
          fill="var(--border)"
        />
        {/* Top content box */}
        <path
          d="M398 104h214.628v65a8 8 0 0 1-8 8H406a8 8 0 0 1-8-8z"
          fill="var(--secondary)"
          stroke="var(--border)"
          strokeWidth={1}
        />
        {/* Text content in top box */}
        <path
          d="M588.758 132H421.871c-1.713 0-3.1 1.791-3.1 4s1.387 4 3.1 4h166.887c1.712 0 3.1-1.791 3.1-4s-1.388-4-3.1-4M588.758 120H421.871c-1.713 0-3.1 1.791-3.1 4s1.387 4 3.1 4h166.887c1.712 0 3.1-1.791 3.1-4s-1.388-4-3.1-4M568.359 144h-146.86c-1.507 0-2.728 2.015-2.728 4.5s1.221 4.5 2.728 4.5h146.86c1.507 0 2.728-2.015 2.728-4.5s-1.221-4.5-2.728-4.5"
          fill="var(--border)"
        />
        {/* Right content box */}
        <rect
          fill="var(--secondary)"
          height={69}
          rx={8}
          stroke="var(--border)"
          strokeWidth={1}
          width={214.628}
          x={552.372}
          y={201}
        />
        {/* Text content in right box */}
        <path
          d="M743.13 225H576.243c-1.712 0-3.1 1.791-3.1 4s1.388 4 3.1 4H743.13c1.712 0 3.1-1.791 3.1-4s-1.388-4-3.1-4M722.731 237h-146.86c-1.507 0-2.728 2.015-2.728 4.5s1.221 4.5 2.728 4.5h146.86c1.507 0 2.728-2.015 2.728-4.5s-1.221-4.5-2.728-4.5"
          fill="var(--border)"
        />
        {/* Toolbar/header at top */}
        <path
          d="M177 86c0-8.837 7.163-16 16-16h638c8.837 0 16 7.163 16 16v24H177z"
          fill="var(--secondary)"
        />
        {/* Border details for toolbar/header */}
        <path
          d="M847 110v1h1v-1zm-670 0h-1v1h1zm16-40v1h638v-2H193zm654 16h-1v24h2V86zm0 24v-1H177v2h670zm-670 0h1V86h-2v24zm654-40v1c8.284 0 15 6.716 15 15h2c0-9.389-7.611-17-17-17zm-638 0v-1c-9.389 0-17 7.611-17 17h2c0-8.284 6.716-15 15-15z"
          fill="var(--border)"
          mask="url(#c)"
        />
        {/* Window controls (dots) */}
        <path
          d="M203 90a6 6 0 1 0-12 0 6 6 0 0 0 12 0M223 90a6 6 0 1 0-12 0 6 6 0 0 0 12 0M243 90a6 6 0 1 0-12 0 6 6 0 0 0 12 0"
          fill="var(--muted-foreground)"
        />
        {/* Horizontal divider */}
        <path d="M398 386.5h369" stroke="var(--border)" />
        {/* Sidebar */}
        <path
          d="M178 110h140v397H194c-8.837 0-16-7.163-16-16z"
          fill="var(--secondary)"
          stroke="var(--border)"
          strokeWidth={1}
        />
      </g>
      <defs>
        <clipPath id="layout-sidebar">
          <path d="M0 0h1028v578H0z" fill="var(--background)" />
        </clipPath>
      </defs>
    </svg>
  );
};

const LayoutFullscreen = (props: SVGProps<SVGSVGElement>) => {
  return (
    <svg
      fill="none"
      height={578}
      viewBox="0 0 1028 578"
      width={1028}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g clipPath="url(#layout-fullscreen)">
        {/* Main background */}
        <path d="M0 0h1028v578H0z" strokeWidth={1} />
        <mask fill="var(--background)" id="b">
          <path
            d="M177 86c0-8.836 7.163-16 16-16h638c8.837 0 16 7.163 16 16v405c0 8.837-7.163 16-16 16H193c-8.837 0-16-7.163-16-16z"
            stroke="var(--border)"
            strokeWidth={1}
          />
        </mask>
        {/* Main content area */}
        <path
          d="M177 86c0-8.836 7.163-16 16-16h638c8.837 0 16 7.163 16 16v405c0 8.837-7.163 16-16 16H193c-8.837 0-16-7.163-16-16z"
          stroke="var(--border)"
          strokeWidth={2}
        />
        {/* Border details for main content area */}
        <path
          d="M193 70v1h638v-2H193zm654 16h-1v405h2V86zm-16 421v-1H193v2h638zm-654-16h1V86h-2v405zm16 16v-1c-8.284 0-15-6.716-15-15h-2c0 9.389 7.611 17 17 17zm654-16h-1c0 8.284-6.716 15-15 15v2c9.389 0 17-7.611 17-17zM831 70v1c8.284 0 15 6.716 15 15h2c0-9.389-7.611-17-17-17zm-638 0v-1c-9.389 0-17 7.611-17 17h2c0-8.284 6.716-15 15-15z"
          fill="var(--background)"
          mask="url(#b)"
        />
        {/* Bottom content box */}
        <rect
          fill="var(--secondary)"
          height={72}
          rx={16}
          stroke="var(--border)"
          strokeWidth={1}
          width={414}
          x={305}
          y={411}
        />
        {/* Middle content box */}
        <rect
          fill="var(--secondary)"
          height={69}
          rx={8}
          stroke="var(--border)"
          strokeWidth={1}
          width={248}
          x={305}
          y={294}
        />
        {/* Text content in middle box */}
        <path
          d="M525.418 318H332.582c-1.978 0-3.582 1.791-3.582 4s1.604 4 3.582 4h192.836c1.978 0 3.582-1.791 3.582-4s-1.604-4-3.582-4M501.848 330H332.152c-1.741 0-3.152 2.015-3.152 4.5s1.411 4.5 3.152 4.5h169.696c1.741 0 3.152-2.015 3.152-4.5s-1.411-4.5-3.152-4.5"
          fill="var(--border)"
        />
        {/* Top content box */}
        <path
          d="M305 104h248v65a8 8 0 0 1-8 8H313a8 8 0 0 1-8-8z"
          fill="var(--secondary)"
          stroke="var(--border)"
          strokeWidth={1}
        />
        {/* Text content in top box */}
        <path
          d="M525.418 132H332.582c-1.978 0-3.582 1.791-3.582 4s1.604 4 3.582 4h192.836c1.978 0 3.582-1.791 3.582-4s-1.604-4-3.582-4M525.418 120H332.582c-1.978 0-3.582 1.791-3.582 4s1.604 4 3.582 4h192.836c1.978 0 3.582-1.791 3.582-4s-1.604-4-3.582-4M501.848 144H332.152c-1.741 0-3.152 2.015-3.152 4.5s1.411 4.5 3.152 4.5h169.696c1.741 0 3.152-2.015 3.152-4.5s-1.411-4.5-3.152-4.5"
          fill="var(--border)"
        />
        {/* Right content box */}
        <rect
          fill="var(--secondary)"
          height={69}
          rx={8}
          stroke="var(--border)"
          strokeWidth={1}
          width={248}
          x={471}
          y={201}
        />
        {/* Text content in right box */}
        <path
          d="M691.418 225H498.582c-1.978 0-3.582 1.791-3.582 4s1.604 4 3.582 4h192.836c1.978 0 3.582-1.791 3.582-4s-1.604-4-3.582-4M667.848 237H498.152c-1.741 0-3.152 2.015-3.152 4.5s1.411 4.5 3.152 4.5h169.696c1.741 0 3.152-2.015 3.152-4.5s-1.411-4.5-3.152-4.5"
          fill="var(--border)"
        />
        {/* Toolbar/header at top */}
        <path
          d="M177 86c0-8.837 7.163-16 16-16h638c8.837 0 16 7.163 16 16v24H177z"
          fill="var(--secondary)"
        />
        {/* Border details for toolbar/header */}
        <path
          d="M847 110v1h1v-1zm-670 0h-1v1h1zm16-40v1h638v-2H193zm654 16h-1v24h2V86zm0 24v-1H177v2h670zm-670 0h1V86h-2v24zm654-40v1c8.284 0 15 6.716 15 15h2c0-9.389-7.611-17-17-17zm-638 0v-1c-9.389 0-17 7.611-17 17h2c0-8.284 6.716-15 15-15z"
          fill="var(--border)"
          mask="url(#c)"
        />
        {/* Window controls (dots) */}
        <path
          d="M203 90a6 6 0 1 0-12 0 6 6 0 0 0 12 0M223 90a6 6 0 1 0-12 0 6 6 0 0 0 12 0M243 90a6 6 0 1 0-12 0 6 6 0 0 0 12 0"
          fill="var(--muted-foreground)"
        />
        {/* Horizontal divider */}
        <path d="M305 386.5h414" stroke="var(--border)" />
      </g>
      <defs>
        <clipPath id="layout-fullscreen">
          <path d="M0 0h1028v578H0z" fill="var(--background)" />
        </clipPath>
      </defs>
    </svg>
  );
};

export function LayoutSettings() {
  const { preferences, setLayout } = useUserPreferences();

  const handleLayoutChange = (layout: LayoutType) => {
    setLayout(layout);
  };

  return (
    <div>
      <h3 className="mb-3 font-medium text-sm">Layout</h3>
      <div className="grid grid-cols-2 gap-3">
        <button
          className={cn(
            'rounded-lg border p-3 text-left transition-colors',
            preferences.layout === 'sidebar'
              ? 'border-primary ring-2 ring-primary/30'
              : 'border-border hover:bg-muted/50'
          )}
          onClick={() => handleLayoutChange('sidebar')}
          type="button"
        >
          <LayoutSidebar className="h-full w-full" />
        </button>

        <button
          className={cn(
            'rounded-lg border p-3 text-left transition-colors',
            preferences.layout === 'fullscreen'
              ? 'border-primary ring-2 ring-primary/30'
              : 'border-border hover:bg-muted/50'
          )}
          onClick={() => handleLayoutChange('fullscreen')}
          type="button"
        >
          <LayoutFullscreen className="h-full w-full" />
        </button>
      </div>
    </div>
  );
}
