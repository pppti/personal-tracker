<template>
  <div class="px-4 py-4 space-y-6">
    <!-- Daily quote -->
    <div class="bg-white rounded-xl p-5 border border-sage-200 shadow-sm">
      <p class="text-sm text-sage-500 mb-2">
        {{ today }}
        <span v-if="stats.current_streak > 0" class="ml-2 text-gold-500">
          已连续修行 {{ stats.current_streak }} 天
        </span>
      </p>
      <p class="text-lg font-serif text-sage-900 leading-relaxed">{{ dailyQuote.body }}</p>
      <p class="text-sm text-sage-500 mt-2 text-right">—— {{ dailyQuote.title }}</p>
    </div>

    <!-- Quick actions -->
    <div class="grid grid-cols-3 gap-3">
      <button @click="$router.push('/practice/new')"
        class="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-sage-200 hover:border-sage-400 transition-colors">
        <svg class="w-7 h-7 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
        </svg>
        <span class="text-xs text-sage-700">写日记</span>
      </button>
      <button @click="$router.push('/draw-lot')"
        class="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-sage-200 hover:border-sage-400 transition-colors">
        <svg class="w-7 h-7 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
        </svg>
        <span class="text-xs text-sage-700">抽签</span>
      </button>
      <button @click="$router.push('/white-noise')"
        class="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-sage-200 hover:border-sage-400 transition-colors">
        <svg class="w-7 h-7 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
        </svg>
        <span class="text-xs text-sage-700">白噪音</span>
      </button>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-white rounded-xl p-3 border border-sage-200 text-center">
        <p class="text-2xl font-bold text-sage-800">{{ stats.total_entries }}</p>
        <p class="text-xs text-sage-500">总记录</p>
      </div>
      <div class="bg-white rounded-xl p-3 border border-sage-200 text-center">
        <p class="text-2xl font-bold text-sage-800">{{ stats.total_minutes }}</p>
        <p class="text-xs text-sage-500">总分钟</p>
      </div>
      <div class="bg-white rounded-xl p-3 border border-sage-200 text-center">
        <p class="text-2xl font-bold text-sage-800">{{ stats.current_streak }}</p>
        <p class="text-xs text-sage-500">连续天数</p>
      </div>
    </div>

    <!-- Recent entries -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-serif font-bold text-sage-800">最近记录</h2>
        <router-link to="/practice" class="text-xs text-sage-500">查看全部</router-link>
      </div>
      <div v-if="loading" class="text-center text-sage-400 py-6">加载中...</div>
      <EmptyState v-else-if="recentEntries.length === 0" text="还没有修行日记" />
      <div v-else class="space-y-2">
        <div v-for="entry in recentEntries" :key="entry.id"
          @click="$router.push(`/practice/${entry.id}`)"
          class="bg-white rounded-lg p-3 border border-sage-100 hover:border-sage-300 cursor-pointer transition-colors">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium text-sage-800">{{ entry.title || '无标题' }}</span>
            <span class="text-xs text-sage-400">{{ entry.practice_date }}</span>
          </div>
          <p class="text-xs text-sage-500 line-clamp-2">{{ entry.body }}</p>
          <div class="flex items-center gap-2 mt-1.5">
            <span v-if="entry.mood" class="text-xs px-2 py-0.5 bg-sage-100 text-sage-600 rounded-full">{{ moodNames[entry.mood] || entry.mood }}</span>
            <span v-if="entry.duration_minutes" class="text-xs text-sage-400">{{ entry.duration_minutes }}分钟</span>
          </div>
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
const stats = ref({ total_entries: 0, total_minutes: 0, current_streak: 0, mood_distribution: {} })
const recentEntries = ref([])
const loading = ref(true)

const moodNames = { calm: '平静', energized: '精力充沛', scattered: '散乱', peaceful: '安宁', tired: '疲惫' }

const dailyQuotes = [
  { title: '禅语', body: '春有百花秋有月，夏有凉风冬有雪。若无闲事挂心头，便是人间好时节。' },
  { title: '道德经', body: '上善若水。水善利万物而不争，处众人之所恶，故几于道。' },
  { title: '六祖坛经', body: '何期自性，本自清净；何期自性，本不生灭；何期自性，本自具足。' },
  { title: '庄子', body: '天地与我并生，而万物与我为一。' },
  { title: '心经', body: '心无挂碍，无挂碍故，无有恐怖，远离颠倒梦想，究竟涅槃。' },
  { title: '金刚经', body: '过去心不可得，现在心不可得，未来心不可得。' },
  { title: '禅语', body: '见山是山，见山不是山，见山还是山。' },
]

const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
const dailyQuote = dailyQuotes[new Date().getDate() % dailyQuotes.length]

onMounted(async () => {
  try {
    const [statsRes, listRes] = await Promise.all([
      api.get('/practices/stats'),
      api.get('/practices?limit=3'),
    ])
    if (statsRes.data) stats.value = statsRes.data
    if (listRes.data) recentEntries.value = listRes.data.items
  } finally {
    loading.value = false
  }
})
</script>
