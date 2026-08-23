import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base: "./" 로 두면 도메인 루트, GitHub Pages 하위 경로(/저장소이름/),
// 안드로이드 앱 안(WebView) 어디에 올려도 같은 빌드 결과물이 그대로 동작합니다.
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // 등록은 main.jsx 에서 직접 합니다 (앱 안에서는 건너뛰려고)
      includeAssets: ["favicon.png", "icons/*.png"],
      manifest: {
        name: "로또 6/45 번호 대조기",
        short_name: "로또 대조기",
        description: "번호 6개를 역대 전 회차와 대조해 1·2·3등 당첨 이력을 찾습니다.",
        lang: "ko",
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0E141B",
        theme_color: "#0E141B",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // 회차 기록(json)까지 미리 받아두어야 비행기모드에서도 대조가 됩니다.
        globPatterns: ["**/*.{js,css,html,png,json,webmanifest}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173, open: true },
  build: { outDir: "dist", assetsDir: "assets" },
});
