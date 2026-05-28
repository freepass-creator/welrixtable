import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

// 빌드 시 영업자 PIN 을 HTML 에 inject — Vercel 환경변수 VITE_AGENT_PIN 으로 변경
// 관리자는 Firebase 로그인 (?admin=1) 사용 — PIN 불필요
function injectGatePins() {
  return {
    name: 'inject-gate-pins',
    transformIndexHtml(html) {
      const agent = process.env.VITE_AGENT_PIN || '1234';
      const tag = `<script>window.__GATE_PINS={agent:${JSON.stringify(agent)}};</script>`;
      return html.replace(/<head>/, '<head>\n' + tag);
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [vue(), injectGatePins()],
  server: {
    port: 5173,
    open: '/index.html',
    // 캐시 완전 비활성 — 새로고침만으로 항상 최신 코드 받음
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        mobile: resolve(__dirname, 'mobile.html'),
      },
    },
  },
});
