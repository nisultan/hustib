import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    // Weight lives on the gym page now.
    return [{ source: "/weight", destination: "/gym", permanent: false }];
  },
};

export default nextConfig;
