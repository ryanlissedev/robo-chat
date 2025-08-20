import type { NextConfig } from 'next';

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = withBundleAnalyzer({
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
  serverExternalPackages: ['shiki', 'vscode-oniguruma'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'www.google.com',
        port: '',
        pathname: '/favicon.ico',
      },
    ],
  },
  eslint: {
    // @todo: remove before going live
    ignoreDuringBuilds: true,
  },
  typescript: {
    // @todo: fix TypeScript errors and remove this before going live
    ignoreBuildErrors: true,
  },
});

export default nextConfig;
