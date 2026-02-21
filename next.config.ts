import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    outputFileTracingRoot: __dirname,
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "picsum.photos" },
        ],
    },
};

export default nextConfig;
