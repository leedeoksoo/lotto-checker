import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" 로 두면 도메인 루트, GitHub Pages 하위 경로(/저장소이름/),
// 로컬 정적 서버 어디에 올려도 같은 빌드 결과물이 그대로 동작합니다.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5173, open: true },
  build: { outDir: "dist", assetsDir: "assets" },
});
