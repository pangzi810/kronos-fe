<template>
  <v-app>
    <!-- Navigation Drawer -->
    <v-navigation-drawer
      v-if="authStore.isAuthenticated"
      v-model="drawer"
      :rail="rail && !mobile"
      :temporary="mobile"
      :permanent="!mobile"
      @click="rail = false"
      disable-resize-watcher
      disable-route-watcher
    >
      <v-list-item
        :prepend-avatar="`https://ui-avatars.com/api/?name=${authStore.user?.name || authStore.user?.preferred_username || 'User'}&background=1976d2&color=fff`"
        :title="authStore.user?.name || authStore.user?.preferred_username || 'User'"
        :subtitle="authStore.user?.email || 'Developer'"
        nav
      >
        <template v-slot:append>
          <v-btn 
            v-if="!mobile"
            variant="text" 
            icon="mdi-chevron-left" 
            @click.stop="rail = !rail"
          ></v-btn>
        </template>
      </v-list-item>

      <v-divider></v-divider>

      <v-list nav>
        <v-list-item
          prepend-icon="mdi-pencil"
          :title="$t('navigation.workRecords')"
          value="work-records"
          :to="{ name: 'work-records' }"
        ></v-list-item>
        <v-list-item
            prepend-icon="mdi-sticker-check-outline"
            :title="$t('navigation.approval')"
            value="approval"
            :to="{ name: 'approval' }"
          ></v-list-item>
          <v-divider></v-divider>

        <!-- Settings section with collapsible JIRA menu -->
        <v-list-group 
          v-can="'jira:write'"
          value="settings" fluid>
          <template v-slot:activator="{ props }">
            <v-list-item
              v-bind="props"
              prepend-icon="mdi-cog"
              :title="$t('navigation.settings')"
            ></v-list-item>
          </template>

        <!-- Users - Admin only -->
          <v-list-item
          v-can="'users:read'"
          prepend-icon="mdi-account-multiple"
          :title="$t('navigation.users')"
          value="users"
          :to="{ name: 'users' }"
        ></v-list-item>

        <!-- Projects - Admin/PMO only -->
        <v-list-item
          v-can="'projects:read'"
          prepend-icon="mdi-folder"
          :title="$t('navigation.projects')"
          value="projects"
          :to="{ name: 'projects' }"
        ></v-list-item>

        
        <!-- JIRA Settings - Admin only -->
        <v-list-item
          prepend-icon="mdi-jira"
          :title="$t('navigation.jiraSettings')"
          v-can="'jira:write'">
        </v-list-item>
        <v-list-item
          v-can="'jira:write'"
          prepend-icon="mdi-connection"
          :title="$t('navigation.jira.settings')"
          value="jira-settings"
          :to="{ name: 'jira-settings' }"
          class="ml-4"
        ></v-list-item>

        <!-- JIRA Sync History - PMO only -->
        <v-list-item
          v-can="'jira:write'"
          prepend-icon="mdi-history"
          :title="$t('navigation.jira.history')"
          value="jira-history"
          :to="{ name: 'jira-history' }"
          class="ml-4"
        ></v-list-item>

        <!-- JQL Settings - PMO only -->
        <v-list-item
          v-can="'jira:write'"
          prepend-icon="mdi-database-search"
          :title="$t('navigation.jira.queries')"
          value="jira-queries"
          :to="{ name: 'jira-queries' }"
          class="ml-4"
        ></v-list-item>

        <!-- JIRA Response Template Settings - PMO only -->
        <v-list-item
          v-can="'jira:write'"
          prepend-icon="mdi-file-document-edit"
          :title="$t('navigation.jira.templates')"
          value="jira-templates"
          :to="{ name: 'jira-templates' }"
          class="ml-4"
        ></v-list-item>

      </v-list-group>

      </v-list>
      <template v-slot:append>
        <v-divider></v-divider>
        <div class="pa-2">
          &copy; 2025 tommy
        </div>
      </template>
    </v-navigation-drawer>

    <!-- App Bar -->
    <v-app-bar>
      <!-- Mobile menu button -->
      <v-app-bar-nav-icon
        v-if="mobile"
        @click="drawer = !drawer"
      ></v-app-bar-nav-icon>

      <v-app-bar-title>
        <v-icon class="me-2">mdi-clock-time-eight</v-icon>
        <span :class="{ 'text-truncate': mobile }">
          {{ appTitle || $t('app.title') }}
        </span>
      </v-app-bar-title>

      <v-spacer></v-spacer>

      <!-- Language Switcher -->
      <LanguageSwitcher class="mr-2" />

      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-account-circle" v-bind="props"></v-btn>
        </template>

        <v-list>
          <v-list-item>
            <v-list-item-title>{{ authStore.user?.name || authStore.user?.preferred_username || 'User' }}</v-list-item-title>
            <v-list-item-subtitle>{{ authStore.user?.email || 'user@example.com' }}</v-list-item-subtitle>
          </v-list-item>

          <v-divider></v-divider>

          <v-list-item
            prepend-icon="mdi-logout"
            :title="$t('auth.logout')"
            @click="handleLogout"
          ></v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <slot></slot>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'
import LanguageSwitcher from '@/components/shared/LanguageSwitcher.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const { mobile } = useDisplay()
const authStore = useAuthStore()


const appTitle = import.meta.env.VITE_APP_TITLE
const drawer = ref(!mobile.value)
const rail = ref(false)

const handleLogout = async () => {
  // Use auth store's logout method which handles both Okta and legacy logout
  await authStore.logout()
  await router.push({ name: 'login' })
}

// Ensure user information is loaded on mount
onMounted(async () => {
  await authStore.ensureUserLoaded()
})
</script>

