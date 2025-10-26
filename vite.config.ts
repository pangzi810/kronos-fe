import { fileURLToPath, URL } from 'node:url'
import { resolve, dirname } from 'node:path'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    VueI18nPlugin({
      include: [resolve(dirname(fileURLToPath(import.meta.url)), './src/i18n/locales/**')],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    // チャンクサイズ警告の閾値を上げる（必要に応じて）
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // マニュアルチャンク設定で依存関係を分割
        manualChunks: {
          // Vue関連のコアライブラリ
          'vue-vendor': ['vue', 'vue-router', 'pinia', 'vue-i18n'],

          // Vuetifyとマテリアルデザインアイコン
          'vuetify': ['vuetify'],

          // Okta認証関連
          'auth': ['@okta/okta-vue', '@okta/okta-auth-js'],

          // ユーティリティライブラリ
          'utils': ['axios', 'date-fns', 'lodash-es', '@vueuse/core'],

          // 通知・UIフィードバック関連
          'ui-feedback': ['vue-toastification', 'vue-json-pretty'],
        },
        // チャンクファイル名の設定
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk'
          return `assets/${facadeModuleId}-[hash].js`
        },
        // エントリーファイル名の設定
        entryFileNames: 'assets/[name]-[hash].js',
        // アセットファイル名の設定
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || ''
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(name)) {
            return `assets/images/[name]-[hash][extname]`
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
            return `assets/fonts/[name]-[hash][extname]`
          }
          return `assets/[name]-[hash][extname]`
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    deps: {
      inline: ['vuetify']
    }
  }
})
