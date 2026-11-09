import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({plugins: [vue()], publicDir: 'static', base: './', server: {port: 5179, strictPort: true}, preview: {port: 4179, strictPort: true}})
