import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { md3 } from 'vuetify/blueprints'
import '@mdi/font/css/materialdesignicons.css'
import { VPie } from 'vuetify/labs/VPie'
import { ja, en } from 'vuetify/locale'

// Vuetify theme configuration
const devHourTheme = {
  dark: false,
  colors: {
    primary: '#1976d2',
    secondary: '#424242',
    accent: '#82b1ff',
    error: '#ff5252',
    info: '#2196f3',
    success: '#4caf50',
    warning: '#ff9800',
    background: '#fafafa',
    surface: '#ffffff',
  },
}

export default createVuetify({
  blueprint: md3,
  components: {
    ...components,
    VPie,
  },
  directives,
  theme: {
    defaultTheme: 'devHourTheme',
    themes: {
      devHourTheme,
    },
  },
  icons: {
    defaultSet: 'mdi',
  },
  locale: {
    locale: 'ja',
    fallback: 'en',
    messages: { ja, en },
  },
})
