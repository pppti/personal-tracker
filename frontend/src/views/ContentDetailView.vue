<template>
  <div class="px-4 py-4">
    <div v-if="loading" class="text-center py-12 text-sage-400">加载中...</div>
    <template v-else-if="content">
      <div class="bg-white rounded-xl p-5 border border-sage-200 shadow-sm">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs px-2 py-0.5 bg-sage-100 text-sage-600 rounded-full">{{ categoryNames[content.category] }}</span>
          <span class="text-xs text-sage-400">{{ content.created_at.slice(0, 10) }}</span>
        </div>
        <h1 class="text-xl font-serif font-bold text-sage-900 mb-3">{{ content.title }}</h1>
        <div class="font-serif text-sage-700 leading-relaxed whitespace-pre-wrap mb-4 text-lg">
          {{ content.body }}
        </div>
        <div class="flex items-center gap-2 flex-wrap mb-3">
          <span v-for="tag in content.tags" :key="tag.id"
            class="text-xs px-2 py-0.5 bg-sage-100 text-sage-500 rounded-full">
            {{ tag.name }}
          </span>
        </div>
        <p v-if="content.source" class="text-sm text-sage-500">—— {{ content.source }}</p>
        <div v-if="content.notes" class="mt-4 pt-4 border-t border-sage-100">
          <p class="text-sm text-sage-500 font-medium mb-1">笔记</p>
          <p class="text-sm text-sage-600">{{ content.notes }}</p>
        </div>
      </div>

      <div class="flex gap-3 mt-8">
        <button @click="$router.back()"
          class="flex-1 py-2.5 border border-sage-400 text-sage-700 rounded-lg text-sm hover:bg-sage-100 transition-colors">
          返回
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
const content = ref(null)
const loading = ref(true)

const categoryNames = { quote: '语录', passage: '段落', sutra: '经文', classic: '经典', book: '书籍', verse: '诗词' }

onMounted(async () => {
  const { data } = await api.get(`/contents/${route.params.id}`)
  if (data) content.value = data
  loading.value = false
})

async function handleDelete() {
  if (!confirm('确定删除这条内容吗？')) return
  await api.delete(`/contents/${route.params.id}`)
  router.push('/library')
}
</script>
