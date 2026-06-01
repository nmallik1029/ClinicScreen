/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  // Allow larger media uploads through server actions (videos up to 100 MB).
  experimental: { serverActions: { bodySizeLimit: "100mb" } },
};

export default nextConfig;
