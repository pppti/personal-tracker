<template>
  <div class="px-4 py-4">
    <h2 class="font-serif font-bold text-sage-800 mb-6">设置</h2>

    <div class="space-y-3">
      <!-- User info -->
      <div class="bg-white rounded-xl p-4 border border-sage-200">
        <p class="text-sm text-sage-500">当前用户</p>
        <p class="font-medium text-sage-800">{{ user?.username }}</p>
      </div>

      <!-- Quick links -->
      <router-link to="/messages"
        class="block bg-white rounded-xl p-4 border border-sage-200 hover:border-sage-400 transition-colors">
        <div class="flex items-center justify-between">
          <span class="text-sage-800">修行寄语</span>
          <svg class="w-4 h-4 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </router-link>

      <router-link to="/white-noise"
        class="block bg-white rounded-xl p-4 border border-sage-200 hover:border-sage-400 transition-colors">
        <div class="flex items-center justify-between">
          <span class="text-sage-800">白噪音</span>
          <svg class="w-4 h-4 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </router-link>

      <!-- Export -->
      <button @click="exportData"
        class="w-full bg-white rounded-xl p-4 border border-sage-200 hover:border-sage-400 transition-colors text-left">
        <div class="flex items-center justify-between">
          <span class="text-sage-800">导出数据 (JSON)</span>
          <svg class="w-4 h-4 text-sage-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
        </div>
      </button>

      <!-- Logout -->
      <button @click="handleLogout"
        class="w-full mt-8 py-3 border border-vermilion-500 text-vermilion-500 rounded-lg hover:bg-vermilion-50 transition-colors">
        退出登录
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useApi } from '../composables/useApi'

const router = useRouter()
const auth = useAuthStore()
const api = useApi()
const user = ref(null)

onMounted(async () => {
  user.value = auth.user
})

async function exportData() {
  const [practicesRes, contentsRes, lotsRes, messagesRes] = await Promise.all([
    api.get('/practices?limit=10000'),
    api.get('/contents?limit=10000'),
    api.get('/lots/history'),
    api.get('/messages'),
  ])

  const data = {
    exported_at: new Date().toISOString(),
    practices: practicesRes.data?.items || [],
    contents: contentsRes.data?.items || [],
    lot_draws: lotsRes.data?.items || [],
    messages: messagesRes.data?.items || [],
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `practice-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>
