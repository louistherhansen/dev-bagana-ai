/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Use default server output so `next start` in Dockerfile.frontend works without a custom standalone entrypoint.
  // (Standalone is optional; can be re-enabled with a multi-stage COPY of `.next/standalone` + `node server.js`.)
  output: undefined,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
};

export default nextConfig;
