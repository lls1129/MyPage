import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  experimental: {
    serverActions: {
      // Photo uploads via Server Action need headroom. Default is 1MB which
      // rejects ordinary phone photos. Vercel Hobby tier may impose its own
      // ~4.5MB platform limit; if we hit that on prod we'll switch to a
      // signed-upload-URL flow that bypasses our server.
      bodySizeLimit: "25mb",
    },
    // Next 16's proxy (was: middleware) has its own request-body cap (10MB
    // default) that fires before the Server Action limit even matters.
    proxyClientMaxBodySize: "25mb",
  },
};

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
});

export default withMDX(nextConfig);
