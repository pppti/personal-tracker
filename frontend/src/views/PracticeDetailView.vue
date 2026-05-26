<template>
  <div class="px-4 py-4">
    <div v-if="loading" class="text-center py-12 text-sage-400">加载中...</div>
    <template v-else-if="entry">
      <div class="bg-white rounded-xl p-5 border border-sage-200 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <h1 class="text-xl font-serif font-bold text-sage-900">{{ entry.title || '无标题' }}</h1>
          <span class="text-xs text-sage-400">{{ entry.practice_date }}</span>
        </div>
        <p class="text-sage-700 leading-relaxed whitespace-pre-wrap">{{ entry.body }}</p>
        <div class="flex items-center gap-3 mt-4 pt-4 border-t border-sage-100">
          <span v-if="entry.mood" class="text-sm px-3 py-1 bg-sage-100 text-sage-600 rounded-full">
            {{ moodNames[entry.mood] || entry.mood }}
          </span>
          <span v-if="entry.duration_minutes" class="text-sm text-sage-500">{{ entry.duration_minutes }} 分钟</span>
        </div>
      </div>

      <div v-if="entry.linked_contents.length" class="mt-6">
        <h2 class="font-serif font-bold text-sage-800 mb-3">关联内容</h2>
        <div class="space-y-2">
          <div v-for="c in entry.linked_contents" :key="c.id"
            @click="$router.push(`/library/${c.id}`)"
            class="bg-white rounded-lg p-3 border border-sage-100 hover:border-sage-300 cursor-pointer transition-colors">
            <p class="font-medium text-sm text-sage-800">{{ c.title }}</p>
            <p class="text-xs text-sage-500 mt-1 line-clamp-2">{{ c.body }}</p>
            <p v-if="c.source" class="text-xs text-sage-400 mt-1">{{ c.source }}</p>
          </div>
        </div>
      </div>

      <div class="flex gap-3 mt-8">
        <button @click="$router.push(`/practice/${entry.id}/edit`)"
          class="flex-1 py-2.5 border border-sage-400 text-sage-700 rounded-lg text-sm hover:bg-sage-100 transition-colors">
          编辑
        </button>
        <button @click="handleDelete"
          class="flex-1 py-2.5 border border-vermilion-500 text-vermilion-500 rounded-lg text-sm hover:bg-vermilion-50 transition-colors">
          删除
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'

const route = useRoute()
const router = useRouter()
const api = useApi()
const entry = ref(null)
const loading = ref(true)

const moodNames = { calm: '平静', energized: '精力充沛', scattered: '散乱', peaceful: '安宁', tired: '疲惫' }

onMounted(async () => {
  const { data } = await api.get(`/practices/${route.params.id}`)
  if (data) entry.value = data
  loading.value = false
})

async function handleDelete() {
  if (!confirm('确定删除这条日记吗？')) return
  await api.delete(`/practices/${route.params.id}`)
  router.push('/practice')
}
</script>
