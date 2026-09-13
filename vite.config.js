import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import devApi from './scripts/dev-api.mjs'

// .env 를 Node 프로세스에 그대로 올린다.
// vite 의 loadEnv 는 VITE_ 접두어만 클라이언트에 노출하므로,
// 서버리스 핸들러가 읽는 KRX_AUTH_KEY·OPENAI_API_KEY 는 이 경로로 들어온다.
// 이 값들은 /api 핸들러(서버측)에서만 쓰이며 번들에 포함되지 않는다.
try { process.loadEnvFile() } catch { /* .env 없음 — 키 없이도 동작 */ }

export default defineConfig({
  // api/*.js 를 vite 개발·프리뷰 서버에 마운트해 로컬에서도 /api 가 동작하게 한다.
  // 배포 환경(Vercel)에서는 이 플러그인이 관여하지 않고 서버리스 함수가 직접 처리한다.
  plugins: [vue(), devApi()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    outDir: 'dist',
    target: 'es2020'
  }
})
