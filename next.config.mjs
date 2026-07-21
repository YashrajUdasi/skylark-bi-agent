/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configure for Vercel deployment with AI streaming
  experimental: {
    // Next.js 14 doesn't need serverActions enabled explicitly, but just in case
  },
  // Ensure we can handle large pdf exports and API limits
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
};

export default nextConfig;
