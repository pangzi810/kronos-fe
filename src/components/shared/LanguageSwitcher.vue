<template>
  <v-menu>
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        variant="text"
        :prepend-icon="currentLocaleIcon"
        class="text-capitalize"
        size="small"
      >
        {{ currentLocaleText }}
      </v-btn>
    </template>
    
    <v-list>
      <v-list-item
        v-for="locale in availableLocales"
        :key="locale.code"
        @click="changeLocale(locale.code)"
        :class="{ 'v-list-item--active': locale.code === currentLocale }"
      >
        <template #prepend>
          <v-icon>{{ locale.icon }}</v-icon>
        </template>
        <v-list-item-title>{{ locale.name }}</v-list-item-title>
        <template #append>
          <v-icon v-if="locale.code === currentLocale" color="primary">
            mdi-check
          </v-icon>
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const availableLocales = [
  { 
    code: 'ja', 
    name: '日本語', 
    icon: 'mdi-translate',
    flag: '🇯🇵'
  },
  { 
    code: 'en', 
    name: 'English', 
    icon: 'mdi-translate',
    flag: '🇺🇸'
  },
  { 
    code: 'zh', 
    name: '中文', 
    icon: 'mdi-translate',
    flag: '🇨🇳'
  }
]

const currentLocale = computed(() => locale.value)

const currentLocaleText = computed(() => {
  const current = availableLocales.find(l => l.code === locale.value)
  return current?.name || 'Language'
})

const currentLocaleIcon = computed(() => {
  const current = availableLocales.find(l => l.code === locale.value)
  return current?.icon || 'mdi-translate'
})

const changeLocale = (newLocale: string) => {
  locale.value = newLocale
  localStorage.setItem('locale', newLocale)
  
  // Optional: Reload page to ensure all components update
  // window.location.reload()
}
</script>

<style scoped>
.v-list-item--active {
  background-color: rgba(var(--v-theme-primary), 0.12);
}
</style>