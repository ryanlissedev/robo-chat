import type { SVGProps } from 'react';

const Icon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={64}
    viewBox="0 0 64 64"
    width={64}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g clipPath="url(#mistral)">
      <path
        d="M9.141 9.067h9.144v9.141H9.141zm36.571 0h9.147v9.141h-9.147z"
        fill="gold"
      />
      <path
        d="M9.141 18.208h18.286v9.144H9.144zm27.43 0h18.285v9.144H36.571z"
        fill="#FFAF00"
      />
      <path d="M9.141 27.355H54.86v9.141H9.14z" fill="#FF8205" />
      <path
        d="M9.141 36.496h9.144v9.141H9.141zm18.288 0h9.144v9.141H27.43zm18.283 0h9.147v9.141h-9.147z"
        fill="#FA500F"
      />
      <path
        d="M0 45.637h27.43v9.144H0zm36.57 0H64v9.144H36.57z"
        fill="#E10500"
      />
    </g>
    <defs>
      <clipPath id="mistral">
        <path d="M0 0h64v64H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
export default Icon;
