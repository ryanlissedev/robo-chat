import * as React from "react"
import type { SVGProps } from "react"

export function RoboRailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Shield shape for security */}
      <path d="M12 2L3.5 7v6c0 4.5 3.5 8.5 8.5 9 5-.5 8.5-4.5 8.5-9V7L12 2z" />
      {/* Lock icon in center */}
      <rect x="9" y="10" width="6" height="5" rx="1" />
      <path d="M10 10V8a2 2 0 1 1 4 0v2" />
    </svg>
  )
}

// Alias for backward compatibility during migration
export const ZolaIcon = RoboRailIcon