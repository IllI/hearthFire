/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['images.unsplash.com', 'firebasestorage.googleapis.com'],
    unoptimized: true,
  },
  eslint: {
    // Disable ESLint during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript during production builds
    ignoreBuildErrors: true,
  },
  // Ensure Next.js serves static files from the public directory
  // This is already the default behavior, but we're adding it explicitly for clarity
  publicRuntimeConfig: {
    staticFolder: '/public',
    NEXT_PUBLIC_DATA_MODE: process.env.NEXT_PUBLIC_DATA_MODE || 'production',
  },
  // Configure static export - commented out for development
  // output: 'export',
  // Ensure trailing slashes are consistent
  trailingSlash: true,
  // Improve static export behavior
  experimental: {
    // These settings help improve compatibility with Firebase Hosting
    isrFlushToDisk: false,
    fallbackNodePolyfills: false
  }
}

module.exports = nextConfig 