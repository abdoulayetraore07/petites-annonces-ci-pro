/** @type {import('next').NextConfig} */

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest.json$/],
});

const nextConfig = {
  // Activation des fonctionnalités expérimentales
  experimental: {
    serverComponentsExternalPackages: ['mongoose', 'bcryptjs'],
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Images optimisées avec Cloudinary
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https', 
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
        pathname: '/**',
      }
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Compression et optimisations
  compress: true,
  poweredByHeader: false,
  generateEtags: false,

  // Redirections et rewrites
  async redirects() {
    return [
      {
        source: '/annonces',
        destination: '/annonces/all',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/:path*`,
      },
    ];
  },

  // Headers de sécurité
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // Configuration TypeScript stricte
  typescript: {
    ignoreBuildErrors: false,
  },

  // Configuration ESLint
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Variables d'environnement publiques
  env: {
    NEXT_PUBLIC_APP_NAME: 'PetitesAnnonces CI',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version,
  },

  // Optimisations de build
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error'],
    } : false,
  },

  // Configuration des domaines autorisés
  domains: process.env.NODE_ENV === 'production' ? [
    'petites-annonces-ci.com',
    'www.petites-annonces-ci.com',
  ] : undefined,

  // Webpack personnalisé
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimisations pour la production
    if (!dev) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      };
    }

    // Support des SVG comme composants React
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },

  // Configuration Sass/CSS
  sassOptions: {
    includePaths: ['./src/styles'],
  },

  // Logging avancé
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // Configuration i18n pour l'internationalisation future
  i18n: {
    locales: ['fr', 'en'],
    defaultLocale: 'fr',
    localeDetection: true,
  },

  // Optimisations runtime
  optimizeFonts: true,
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}',
      skipDefaultConversion: true,
    },
  },
};

// Application des plugins
module.exports = withBundleAnalyzer(withPWA(nextConfig));