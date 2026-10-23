import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Posters live in Vercel Blob; Next.js resizes them to screen size and converts to WebP.
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
    formats: ['image/webp'],
    // A short list of widths keeps the number of generated variants (and the monthly quota) small.
    deviceSizes: [640, 828, 1080, 1600], // 1600 is only requested by the enlarged view
    imageSizes: [128, 256, 384],
    qualities: [75],
    // Blob URLs never change for a given file, so resized copies can be cached for a long time.
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
};

export default nextConfig;