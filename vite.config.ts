import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const githubPagesBase = '/scientific-chart-editor/'

// GitHub Pagesとproduction previewではrepository名を含むURL、開発時はlocalhost直下で配信する。
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? githubPagesBase : '/',
  plugins: [react()],
}))
