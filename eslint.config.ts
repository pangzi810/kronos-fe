import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    rules: {
      // Allow Vuetify's v-slot shorthand with dot notation (e.g., #item.name)
      'vue/valid-v-slot': ['error', { allowModifiers: true }],
      // Warn on unused vars instead of error to avoid blocking builds
      '@typescript-eslint/no-unused-vars': 'warn',
      // Allow any type in some cases (can be gradually fixed)
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
