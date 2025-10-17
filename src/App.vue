<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onMounted, computed } from 'vue'
import AppLayout from './components/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// Initialize auth state on app startup
onMounted(async () => {
  await authStore.checkAuthStatus()
})

// Use auth store state instead of undefined authState
const isAuthenticated = computed(() => authStore.isAuthenticated)
</script>

<template>
  <div v-if="isAuthenticated">
    <AppLayout>
      <RouterView />
    </AppLayout>
  </div>
  <v-app v-else>
    <RouterView />
  </v-app>
</template>
