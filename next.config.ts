import type { NextConfig } from 'next';

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
  // Turbopack configuration for improved compatibility
  turbopack: {
    resolveExtensions: ['.mdx', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
    // Disable conflicting webpack-style configurations
    // All webpack-specific rules should be removed to prevent conflicts
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
    ],
  },
  eslint: {
    // @todo: remove before going live
    ignoreDuringBuilds: true,
  },
};

// Apply bundle analyzer only when explicitly enabled
// Turbopack handles development properly, so we can simplify this logic
const finalConfig =
  process.env.ANALYZE === 'true' ? withBundleAnalyzer(nextConfig) : nextConfig;

export default finalConfig;
