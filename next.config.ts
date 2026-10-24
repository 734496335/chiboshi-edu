import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",

  // Windsurf 的 Browser Preview 代理用 127.0.0.1 访问，Next.js 16 默认会拦截
  // 非 localhost 的 dev 资源请求（含 HMR），这里把 127.0.0.1 显式放行。
  allowedDevOrigins: ["127.0.0.1"],

  // standalone 模式：next build 后在 .next/standalone/ 生成包含最小 node_modules
  // 的自包含服务，配合 portable node.exe 可以直接在教室 Windows 跑，不需安装 Node。
  output: "standalone",

  // Local operations and credentials must never enter a shareable classroom bundle.
  outputFileTracingExcludes: {
    "/*": [
      "./.git/**/*",
      "./.local/**/*",
      "./.understand-anything/**/*",
      "./.env*",
      "./llm_config.json",
      "./docs/**/*",
      "./scripts/deploy_helper.py",
      "./chiboshi-standalone.zip",
      "./尺博士/**/*",
      "./猫啃什锦黑1.70/**/*",
      "./_regen_logs/**/*",
      "./*.log",
      "./*.zip",
    ],
  },
};

export default nextConfig;
