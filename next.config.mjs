/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  experimental: {
    // Local-dev fallback upload path goes through a server action; production
    // uploads go straight to R2.
    serverActions: { bodySizeLimit: "100mb" },
    // Cache visited/prefetched pages on the client so navigating between tabs is
    // instant within the window instead of re-fetching on every first visit.
    staleTimes: { dynamic: 30, static: 180 },
  },
  async headers() {
    // Defense-in-depth headers on every response. (A full CSP is intentionally
    // omitted for now to avoid breaking Next's inline scripts / media loads.)
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
