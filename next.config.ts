import type { NextConfig } from 'next';

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = withBundleAnalyzer({
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react', 'lucide-react', '@radix-ui/react-icons'],
  },
  serverExternalPackages: ['shiki', 'vscode-oniguruma'],

  // Optimize webpack bundle
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    // Ignore warnings for react-syntax-highlighter
    config.ignoreWarnings = [
      /Failed to parse source map/,
      /Attempted import error.*refractor/,
    ];

    // Tree shaking optimization
    config.optimization = {
      ...config.optimization,
      usedExports: true,
      sideEffects: false,
    };

    return config;
  },
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
        pathname: '/s2/favicons',
      },
    ],
  },

  typescript: {
    // Re-enable TypeScript validation to see build errors
    ignoreBuildErrors: false,
  },
});

export default nextConfig;
