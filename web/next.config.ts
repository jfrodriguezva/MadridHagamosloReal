import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" produce web/.next/standalone/server.js -- un servidor Node
  // autónomo que el instalador empaqueta junto a un Node portable, sin
  // depender de `npm run dev` ni del repo completo en la máquina final.
  output: "standalone",
};

export default nextConfig;
