<template>
  <div class="px-4 py-4">
    <div class="text-center mb-6">
      <h2 class="font-serif font-bold text-sage-800 text-xl mb-1">抽签</h2>
      <p class="text-sm text-sage-500">诚心默念，拈一瓣心香</p>
    </div>

    <!-- Category filter -->
    <div class="flex justify-center gap-3 mb-6">
      <button v-for="cat in categories" :key="cat.value"
        @click="selectedCategory = cat.value"
        class="px-4 py-1.5 rounded-full text-sm border transition-colors"
        :class="selectedCategory === cat.value ? 'bg-sage-200 border-sage-400 text-sage-800' : 'bg-white border-sage-200 text-sage-600'">
        {{ cat.label }}
      </button>
    </div>

    <!-- Drawing area -->
    <div v-if="!result" class="flex flex-col items-center">
      <button @click="draw"
        :disabled="drawing"
        class="w-32 h-32 rounded-full bg-sage-200 border-4 border-sage-400 flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        :class="{ 'animate-pulse': drawing }">
        <svg class="w-12 h-12 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
        </svg>
      </button>
      <p class="text-sm text-sage-500 mt-4">{{ drawing ? '抽取中...' : '点击抽签' }}</p>
    </div>

    <!-- Result -->
    <div v-if="result" class="bg-white rounded-xl p-6 border border-sage-200 shadow-sm animate-fadeIn">
      <div class="text-center mb-4">
        <span class="text-sm px-3 py-1 bg-sage-100 text-sage-600 rounded-full">{{ categoryNames[result.lot.category] || result.lot.category }}</span>
        <span v-if="result.lot.number" class="text-xs text-sage-400 ml-2">第 {{ result.lot.number }} 签</span>
      </div>
      <h3 class="text-2xl font-serif font-bold text-sage-900 text-center mb-4">{{ result.lot.title }}</h3>
      <div class="bg-sage-50 rounded-lg p-4 mb-4">
        <p class="font-serif text-lg text-sage-800 leading-relaxed text-center">{{ result.lot.body }}</p>
      </div>
      <p class="text-sm text-sage-600 leading-relaxed mb-3">{{ result.lot.explanation }}</p>
      <p v-if="result.lot.source" class="text-sm text-sage-500 text-right">—— {{ result.lot.source }}</p>

      <div class="flex gap-3 mt-6">
        <button @click="result = null"
          class="flex-1 py-2.5 border border-sage-400 text-sage-700 rounded-lg text-sm hover:bg-sage-100 transition-colors">
          再抽一签
        </button>
        <button @click="showHistory = !showHistory"
          class="flex-1 py-2.5 bg-sage-800 text-white rounded-lg text-sm hover:bg-sage-700 transition-colors">
          {{ showHistory ? '收起历史' : '查看历史' }}
        </button>
      </div>
    </div>

    <!-- Draw history -->
    <div v-if="showHistory" class="mt-6">
      <h3 class="font-serif font-bold text-sage-800 mb-3">抽签历史</h3>
      <div v-if="historyLoading" class="text-center text-sage-400 text-sm py-4">加载中...</div>
      <div v-else-if="history.length === 0" class="text-center text-sage-400 text-sm py-4">还没有抽签记录</div>
      <div v-else class="space-y-2">
        <div v-for="h in history" :key="h.id"
          class="bg-white rounded-lg p-3 border border-sage-100">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-sage-800">{{ h.lot.title }}</span>
            <span class="text-xs text-sage-400">{{ h.drawn_at.slice(0, 16).replace('T', ' ') }}</span>
          </div>
          <p class="text-xs text-sage-500 mt-1 line-clamp-1">{{ h.lot.body }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useApi } from '../composables/useApi'

const api = useApi()
const selectedCategory = ref('')
const drawing = ref(false)
const result = ref(null)
const showHistory = ref(false)
const history = ref([])
const historyLoading = ref(false)

const categories = [
  { value: '', label: '全部' },
  { value: 'buddhist', label: '佛家' },
  { value: 'daoist', label: '道家' },
]
const categoryNames = { buddhist: '佛家', daoist: '道家', classic: '经典', general: '通用' }

async function draw() {
  drawing.value = true
  result.value = null
  try {
    let url = '/lots/draw'
    if (selectedCategory.value) url += `?category=${selectedCategory.value}`
    const { data } = await api.post(url)
    if (data) result.value = data
  } finally {
    drawing.value = false
  }
}

watch(showHistory, async (val) => {
  if (val && history.value.length === 0) {
    historyLoading.value = true
    const { data } = await api.get('/lots/history')
    if (data) history.value = data.items
    historyLoading.value = false
  }
})
</script>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn 0.5s ease-out;
}
</style>
