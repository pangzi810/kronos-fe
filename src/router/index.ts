import { createRouter, createWebHistory } from 'vue-router'
import { navigationGuard } from '@okta/okta-vue'
import { 
  requireAuth, 
  handleOktaCallback, 
  redirectIfAuthenticated,
  requireScope,
  requireAnyScope
} from './guards'
import './types' // Import router type declarations

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import(/* webpackChunkName: "auth" */ '../views/LoginView.vue'),
      beforeEnter: redirectIfAuthenticated
    },
    {
      path: '/callback',
      name: 'callback',
      component: () => import(/* webpackChunkName: "auth" */ '../views/CallbackView.vue'),
      beforeEnter: handleOktaCallback
    },
    {
      path: '/',
      name: 'home',
      component: () => import(/* webpackChunkName: "work-records" */ '../views/WorkRecordView.vue'),
      beforeEnter: requireAuth,
      meta: { requiresAuth: true },
    },
    {
      path: '/users',
      name: 'users',
      component: () => import(/* webpackChunkName: "admin" */ '../views/UsersView.vue'),
      beforeEnter: requireScope('users:read'),
      meta: { requiresAuth: true},
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import(/* webpackChunkName: "projects" */ '../views/ProjectsView.vue'),
      beforeEnter: requireScope('projects:read'),
      meta: { requiresAuth: true },
    },
    {
      path: '/work-records',
      name: 'work-records',
      component: () => import(/* webpackChunkName: "work-records" */ '../views/WorkRecordView.vue'),
      beforeEnter: requireAuth,
      meta: { requiresAuth: true},
    },
    {
      path: '/approval',
      name: 'approval',
      component: () => import(/* webpackChunkName: "approval" */ '../views/ApprovalView.vue'),
      beforeEnter: requireScope('work-hours:approve'),
      meta: { requiresAuth: true },
    },
    {
      path: '/jira',
      name: 'jira-settings',
      component: () => import(/* webpackChunkName: "jira" */ '../views/JiraSettingsView.vue'),
      beforeEnter: requireScope('jira:write'),
      meta: { requiresAuth: true},
    },
    {
      path: '/jira/queries',
      name: 'jira-queries',
      component: () => import(/* webpackChunkName: "jira" */ '../views/JqlQueryView.vue'),
      beforeEnter: requireScope('jira:write'),
      meta: { requiresAuth: true},
    },
    {
      path: '/jira/templates',
      name: 'jira-templates',
      component: () => import(/* webpackChunkName: "jira" */ '../views/ResponseTemplateView.vue'),
      beforeEnter: requireScope('jira:write'),
      meta: { requiresAuth: true},
    },
    {
      path: '/jira/history',
      name: 'jira-history',
      component: () => import(/* webpackChunkName: "jira" */ '../views/SyncHistoryView.vue'),
      beforeEnter: requireScope('jira:write'),
      meta: { requiresAuth: true},
    },
  ],
})

router.beforeEach(navigationGuard)

export default router
