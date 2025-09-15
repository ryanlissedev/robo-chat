import React from 'react';
import type { SVGProps } from 'react';

export function ZolaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className="bg-primary"
      fill="none"
      height={80}
      viewBox="0 0 80 80"
      width={80}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g clipPath="url(#zola)">
        <mask
          height={80}
          id="zola"
          maskUnits="userSpaceOnUse"
          style={{
            maskType: 'luminance',
          }}
          width={80}
          x={0}
          y={0}
        >
          <path d="M80 0H0v80h80z" fill="currentColor" />
        </mask>
        <g fill="currentColor" mask="url(#b)">
          <path d="M8 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M8 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M8 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 76a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 4a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M80 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M68 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 76a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M20 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0M32 4a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 76a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 64a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M56 4a4 4 0 1 0-8 0 4 4 0 0 0 8 0M80 52a4 4 0 1 0-8 0 4 4 0 0 0 8 0M44 40a4 4 0 1 0-8 0 4 4 0 0 0 8 0M80 28a4 4 0 1 0-8 0 4 4 0 0 0 8 0" />
        </g>
      </g>
      <defs>
        <clipPath id="zola">
          <path d="M0 0h80v80H0z" fill="currentColor" />
        </clipPath>
      </defs>
    </svg>
  );
}
