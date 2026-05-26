<template>
  <div class="px-4 py-4">
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-serif font-bold text-sage-800">修行寄语</h2>
    </div>

    <!-- Generate -->
    <div class="bg-white rounded-xl p-4 border border-sage-200 mb-6">
      <p class="text-sm text-sage-600 mb-3">基于你的修行记录，AI 将为你生成一段修行寄语。</p>
      <div class="flex items-center gap-3">
        <select v-model.number="periodDays"
          class="px-3 py-2 rounded-lg border border-sage-200 bg-white text-sm text-sage-700">
          <option :value="3">最近 3 天</option>
          <option :value="7">最近 7 天</option>
          <option :value="14">最近 14 天</option>
          <option :value="30">最近 30 天</option>
        </select>
        <button @click="generate"
          :disabled="generating"
          class="flex-1 py-2 bg-sage-800 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50 transition-colors font-serif">
          {{ generating ? '生成中...' : '生成寄语' }}
        </button>
      </div>
      <p v-if="genError" class="text-vermilion-500 text-xs mt-2">{{ genError }}</p>
    </div>

    <!-- Message list -->
    <div v-if="loading" class="text-center text-sage-400 py-6">加载中...</div>
    <EmptyState v-else-if="messages.length === 0" text="还没有修行寄语，点击上方生成吧" />

    <div v-else class="space-y-4">
      <div v-for="msg in messages" :key="msg.id"
        @click="selected = selected?.id === msg.id ? null : msg"
        class="bg-white rounded-xl p-5 border cursor-pointer transition-colors"
        :class="[selected?.id === msg.id ? 'border-sage-400 shadow-sm' : 'border-sage-100 hover:border-sage-300', { 'border-l-4 border-l-gold-500': !msg.is_read }]">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-sage-800">{{ msg.title }}</span>
          <span class="text-xs text-sage-400">{{ msg.generated_at.slice(0, 10) }}</span>
        </div>
        <p class="text-sm text-sage-600 leading-relaxed" :class="{ 'line-clamp-3': selected?.id !== msg.id }">
          {{ msg.body }}
        </p>
        <div v-if="msg.period_start" class="flex items-center gap-2 mt-3 pt-3 border-t border-sage-100">
          <span class="text-xs text-sage-400">{{ msg.period_start }} ~ {{ msg.period_end }}</span>
          <span v-if="!msg.is_read" class="text-xs px-2 py-0.5 bg-gold-100 text-gold-600 rounded-full">新</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import EmptyState from '../components/common/EmptyState.vue'

const api = useApi()
const messages = ref([])
const loading = ref(true)
const generating = ref(false)
const genError = ref('')
const periodDays = ref(7)
const selected = ref(null)

async function generate() {
  genError.value = ''
  generating.value = true
  try {
    const { data, error } = await api.post('/messages/generate', { period_days: periodDays.value })
    if (data) {
      messages.value.unshift(data)
      selected.value = data
    } else {
      genError.value = error || '生成失败'
    }
  } finally {
    generating.value = false
  }
}

onMounted(async () => {
  const { data } = await api.get('/messages')
  if (data) messages.value = data.items
  loading.value = false
})
</script>
