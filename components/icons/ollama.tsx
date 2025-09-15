import React from 'react';
import type { SVGProps } from 'react';

const Icon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    height={64}
    viewBox="0 0 64 64"
    width={64}
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Ollama"
    {...props}
  >
    <title>Ollama</title>
    <path
      d="M32 8C18.745 8 8 18.745 8 32s10.745 24 24 24 24-10.745 24-24S45.255 8 32 8zm0 4c11.046 0 20 8.954 20 20s-8.954 20-20 20-20-8.954-20-20 8.954-20 20-20z"
      fill="currentColor"
    />
    <circle cx="32" cy="32" fill="currentColor" r="12" />
    <circle cx="32" cy="32" fill="white" r="6" />
  </svg>
);
export default Icon;
