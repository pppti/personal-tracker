import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/RegisterView.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/practice',
    name: 'PracticeList',
    component: () => import('../views/PracticeListView.vue'),
  },
  {
    path: '/practice/new',
    name: 'PracticeNew',
    component: () => import('../views/PracticeFormView.vue'),
  },
  {
    path: '/practice/:id',
    name: 'PracticeDetail',
    component: () => import('../views/PracticeDetailView.vue'),
  },
  {
    path: '/practice/:id/edit',
    name: 'PracticeEdit',
    component: () => import('../views/PracticeFormView.vue'),
  },
  {
    path: '/library',
    name: 'Library',
    component: () => import('../views/LibraryView.vue'),
  },
  {
    path: '/library/import',
    name: 'ContentImport',
    component: () => import('../views/ContentImportView.vue'),
  },
  {
    path: '/library/:id',
    name: 'ContentDetail',
    component: () => import('../views/ContentDetailView.vue'),
  },
  {
    path: '/draw-lot',
    name: 'DrawLot',
    component: () => import('../views/DrawLotView.vue'),
  },
  {
    path: '/white-noise',
    name: 'WhiteNoise',
    component: () => import('../views/WhiteNoiseView.vue'),
  },
  {
    path: '/messages',
    name: 'Messages',
    component: () => import('../views/MessagesView.vue'),
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.meta.guest) {
    if (auth.token) return next('/')
    return next()
  }
  if (!auth.token && to.name !== 'Login' && to.name !== 'Register') {
    return next('/login')
  }
  next()
})

export default router
