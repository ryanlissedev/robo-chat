import * as React from "react"
import type { SVGProps } from "react"

export function RoboRailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 400 400"
      {...props}
    >
      {/* Blue background */}
      <rect width="400" height="400" fill="#03189B" rx="40"/>
      
      {/* HGG Text */}
      <text 
        x="200" 
        y="160" 
        textAnchor="middle" 
        fill="white" 
        fontFamily="Arial Black, sans-serif" 
        fontSize="120" 
        fontWeight="900"
      >
        HGG
      </text>
      
      {/* Circular logo with crossed elements */}
      <g transform="translate(200, 280)">
        {/* White circle background */}
        <circle cx="0" cy="0" r="80" fill="white"/>
        
        {/* Blue crossed elements inside circle */}
        <g fill="#03189B">
          {/* Horizontal bar */}
          <rect x="-50" y="-8" width="100" height="16"/>
          {/* Vertical bar */}
          <rect x="-8" y="-50" width="16" height="100"/>
          {/* Diagonal bars */}
          <rect x="-45" y="-8" width="90" height="16" transform="rotate(45)"/>
          <rect x="-45" y="-8" width="90" height="16" transform="rotate(-45)"/>
          {/* Arrow-like elements */}
          <polygon points="-60,-20 -40,-20 -50,-30"/>
          <polygon points="40,-20 60,-20 50,-30"/>
          <polygon points="20,-60 20,-40 30,-50"/>
          <polygon points="20,40 20,60 30,50"/>
        </g>
      </g>
    </svg>
  )
}

// Alias for backward compatibility during migration
export const ZolaIcon = RoboRailIcon