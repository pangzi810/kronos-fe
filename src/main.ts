import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Toast, { type PluginOptions, POSITION } from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import { OktaAuth } from '@okta/okta-auth-js'
import OktaVue from '@okta/okta-vue'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import permissionPlugin from './plugins/permission'
import i18n from './i18n'
import { oktaConfig } from '@/config/okta.config'
import { setOktaAuthInstance } from '@/stores/auth'

// Initialize Okta authentication
const oktaAuth = new OktaAuth(oktaConfig)

// Set global OktaAuth instance for the auth store
setOktaAuthInstance(oktaAuth)

// Validate configuration in development
if (import.meta.env.DEV) {
  if (!oktaConfig.issuer || oktaConfig.issuer.includes('your-domain')) {
    console.warn('⚠️  Okta issuer not properly configured. Please set VITE_OKTA_ISSUER environment variable.')
  }
  if (!oktaConfig.clientId) {
    console.warn('⚠️  Okta client ID not configured. Please set VITE_OKTA_CLIENT_ID environment variable.')
  }
  console.log('🔐 Okta authentication initialized')
}

const app = createApp(App)
const pinia = createPinia()

// Toast notification options
const toastOptions: PluginOptions = {
  position: POSITION.TOP_RIGHT,
  timeout: 5000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false
}

// Register plugins in dependency order
app.use(pinia) // State management first
app.use(OktaVue, { oktaAuth }) // Authentication plugin
app.use(router) // Router for navigation
app.use(vuetify) // UI framework
app.use(permissionPlugin) // Permission directives
app.use(i18n) // Internationalization
app.use(Toast, toastOptions) // Notification system

app.mount('#app')
