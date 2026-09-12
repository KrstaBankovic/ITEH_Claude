import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 writes its own agent instruction file on dev start; this repo maintains
  // its own by hand, so keep the generator off.
  agentRules: false,
};

export default nextConfig;
