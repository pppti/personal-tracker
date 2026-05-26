<template>
  <div class="px-4 py-4">
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-serif font-bold text-sage-800">书库</h2>
      <router-link to="/library/import" class="bg-sage-800 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-sage-700 transition-colors">
        导入
      </router-link>
    </div>

    <!-- Search & filter -->
    <div class="flex gap-2 mb-4">
      <input v-model="search" @input="searchDebounced" placeholder="搜索内容..."
        class="flex-1 px-3 py-2 rounded-lg border border-sage-200 text-sm focus:outline-none focus:border-sage-500" />
      <select v-model="category" @change="fetchContents"
        class="px-3 py-2 rounded-lg border border-sage-200 text-sm bg-white text-sage-700">
        <option value="">全部分类</option>
        <option value="quote">语录</option>
        <option value="passage">段落</option>
        <option value="sutra">经文</option>
        <option value="classic">经典</option>
        <option value="book">书籍</option>
        <option value="verse">诗词</option>
      </select>
    </div>

    <!-- Tags -->
    <div v-if="tags.length" class="flex gap-2 flex-wrap mb-4">
      <button v-for="tag in tags" :key="tag.id"
        @click="toggleTag(tag.id)"
        class="px-2 py-1 rounded-full text-xs border transition-colors"
        :class="selectedTag === tag.id ? 'bg-sage-300 border-sage-400 text-sage-800' : 'bg-white border-sage-200 text-sage-600'">
        {{ tag.name }}
      </button>
    </div>

    <div v-if="loading" class="text-center text-sage-400 py-6">加载中...</div>
    <EmptyState v-else-if="contents.length === 0" text="书库中还没有内容" />
    <div v-else class="space-y-2">
      <div v-for="c in contents" :key="c.id"
        @click="$router.push(`/library/${c.id}`)"
        class="bg-white rounded-lg p-3 border border-sage-100 hover:border-sage-300 cursor-pointer transition-colors">
        <div class="flex items-center justify-between mb-1">
          <span class="font-medium text-sm text-sage-800">{{ c.title }}</span>
          <span class="text-xs text-sage-400">{{ categoryNames[c.category] || c.category }}</span>
        </div>
        <p class="text-xs text-sage-500 line-clamp-2">{{ c.body }}</p>
        <div class="flex items-center gap-1 mt-1.5 flex-wrap">
          <span v-for="tag in c.tags" :key="tag.id"
            class="text-xs px-1.5 py-0.5 bg-sage-100 text-sage-500 rounded">
            {{ tag.name }}
          </span>
          <span v-if="c.source" class="text-xs text-sage-400 ml-auto">{{ c.source }}</span>
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
const contents = ref([])
const tags = ref([])
const loading = ref(true)
const search = ref('')
const category = ref('')
const selectedTag = ref(null)

const categoryNames = { quote: '语录', passage: '段落', sutra: '经文', classic: '经典', book: '书籍', verse: '诗词' }

let searchTimer = null
function searchDebounced() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(fetchContents, 300)
}

function toggleTag(tagId) {
  selectedTag.value = selectedTag.value === tagId ? null : tagId
  fetchContents()
}

async function fetchContents() {
  loading.value = true
  let url = `/contents?limit=50`
  if (search.value) url += `&search=${encodeURIComponent(search.value)}`
  if (category.value) url += `&category=${category.value}`
  if (selectedTag.value) url += `&tag_id=${selectedTag.value}`
  const { data } = await api.get(url)
  if (data) contents.value = data.items
  loading.value = false
}

onMounted(async () => {
  const [tagRes] = await Promise.all([
    api.get('/tags'),
    fetchContents(),
  ])
  if (tagRes.data) tags.value = tagRes.data
})
</script>
