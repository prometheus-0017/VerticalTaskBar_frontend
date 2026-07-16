import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server:{
    proxy:{
      '/icons':{
        target:'http://localhost:15000',
        changeOrigin:true,
        // rewrite:path=>path.replace(/^\/api/,'')
      }
    }
  }
})
