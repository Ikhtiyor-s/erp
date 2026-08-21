import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1",
  },
  async headers() {
    return [
      {
        // Never cache HTML pages — only static /_next/static/* assets get long cache.
        source: "/((?!_next/static).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Proxy /api/v1/* to the backend container (so PWA via ngrok works on single URL)
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_INTERNAL_URL || "http://api:8000"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
