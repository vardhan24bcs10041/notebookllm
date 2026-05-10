/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for Vercel serverless
  serverExternalPackages: ["pdf-parse"],
  
  // Increase API route body size for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
