import type { SVGProps } from 'react';

const Icon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={64}
    viewBox="0 0 64 64"
    width={64}
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Gemini"
    {...props}
  >
    <title>Gemini</title>
    <g clipPath="url(#gemini)">
      <path
        d="M32 64A38.14 38.14 0 0 0 0 32 38.14 38.14 0 0 0 32 0a38.15 38.15 0 0 0 32 32 38.15 38.15 0 0 0-32 32"
        fill="url(#b)"
      />
    </g>
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="b"
        x1={0}
        x2={4398.72}
        y1={6400}
        y2={1945.28}
      >
        <stop stopColor="#1C7DFF" />
        <stop offset={0.52} stopColor="#1C69FF" />
        <stop offset={1} stopColor="#F0DCD6" />
      </linearGradient>
      <clipPath id="gemini">
        <path d="M0 0h64v64H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
export default Icon;
