import * as React from "react"
import type { SVGProps } from "react"

const Icon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={64}
    height={64}
    viewBox="0 0 64 64"
    fill="none"
    {...props}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M32 8c13.255 0 24 10.745 24 24s-10.745 24-24 24S8 45.255 8 32 18.745 8 32 8zm0 4c11.046 0 20 8.954 20 20s-8.954 20-20 20-20-8.954-20-20 8.954-20 20-20z"
      clipRule="evenodd"
    />
    <path
      fill="currentColor"
      d="M32 16c8.837 0 16 7.163 16 16s-7.163 16-16 16-16-7.163-16-16 7.163-16 16-16zm0 8c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8z"
    />
    <circle cx={32} cy={32} r={4} fill="currentColor" />
  </svg>
)

export default Icon