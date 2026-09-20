/**
 * @file next.config.mjs
 * @description Next.js 15 configuration for UPA-GURU Pan-India Government Exam Notification Portal.
 * Enforces React strict mode, disables server fingerprinting, and implements OWASP-compliant security headers.
 * 
 * Task Reference: TASK-01030103 (SUB-0103010301), TASK-07010101 (SUB-0701010102)
 * Architecture Reference: ADR-001, ADR-005, ADR-013
 */

import { withSentryConfig } from '@sentry/nextjs';

/**
 * Content Security Policy directives
 */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://*.posthog.com https://*.google-analytics.com https://*.googletagmanager.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https://*.supabase.co https://lh3.googleusercontent.com https://*.google-analytics.com;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.upstash.io https://*.sentry.io https://*.posthog.com https://*.google-analytics.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim();

/**
 * Security headers applied to all application routes
 */
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: cspHeader,
  },
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
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
];

/**
 * CORS headers applied strictly to API routes (/api/*)
 */
const apiCorsHeaders = [
  {
    key: 'Access-Control-Allow-Credentials',
    value: 'true',
  },
  {
    key: 'Access-Control-Allow-Origin',
    value: process.env.NEXT_PUBLIC_SITE_URL || 'https://upaguru.in',
  },
  {
    key: 'Access-Control-Allow-Methods',
    value: 'GET,POST,PUT,DELETE,OPTIONS',
  },
  {
    key: 'Access-Control-Allow-Headers',
    value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply OWASP security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Apply CORS headers to all API endpoints
        source: '/api/:path*',
        headers: apiCorsHeaders,
      },
    ];
  },
};

/**
 * Sentry Build and Source Map Upload Configuration

 * - Uploads source maps during CI/production builds
 * - Hides source maps from public client bundles (prevents IP/code leakage)
 * - Automatically instruments server actions and route handlers
 */
const sentryOptions = {
  org: process.env.SENTRY_ORG || 'upa-guru',
  project: process.env.SENTRY_PROJECT || 'upa-guru-web',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
};

export default withSentryConfig(nextConfig, sentryOptions);
