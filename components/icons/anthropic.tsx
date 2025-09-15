import React from 'react';
import type { SVGProps } from 'react';

const Icon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={245}
    viewBox="0 0 245 245"
    width={245}
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Anthropic"
    {...props}
  >
    <title>Anthropic</title>
    <path
      clipRule="evenodd"
      d="M141.151 35.933h36.78L245 204.166h-36.781zm-74.093 0h38.455l67.069 168.233h-37.505l-13.71-35.331H51.215l-13.72 35.321H0L67.069 35.953zm42.181 101.665L86.291 78.471l-22.948 59.137h45.886z"
      fill="#000"
      fillRule="evenodd"
    />
  </svg>
);
export default Icon;
