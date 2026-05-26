<template>
  <div class="min-h-screen flex items-center justify-center px-6 bg-sage-50">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-serif font-bold text-sage-900 mb-2">创建账号</h1>
        <p class="text-sage-500 text-sm">开始你的修行记录之旅</p>
      </div>
      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <input v-model="username" type="text" placeholder="用户名" required
            class="w-full px-4 py-3 rounded-lg border border-sage-200 bg-white focus:outline-none focus:border-sage-500 text-ink-900" />
        </div>
        <div>
          <input v-model="password" type="password" placeholder="密码" required minlength="4"
            class="w-full px-4 py-3 rounded-lg border border-sage-200 bg-white focus:outline-none focus:border-sage-500 text-ink-900" />
        </div>
        <p v-if="error" class="text-vermilion-500 text-sm text-center">{{ error }}</p>
        <button type="submit" :disabled="loading"
          class="w-full py-3 bg-sage-800 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors font-serif">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>
      <p class="text-center mt-6 text-sage-500 text-sm">
        已有账号？<router-link to="/login" class="text-sage-700 underline">登录</router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleRegister() {
  error.value = ''
  loading.value = true
  try {
    await auth.register(username.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
