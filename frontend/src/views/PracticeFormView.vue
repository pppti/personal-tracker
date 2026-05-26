<template>
  <div class="px-4 py-4">
    <h2 class="font-serif font-bold text-sage-800 mb-4">{{ isEdit ? '编辑日记' : '新增日记' }}</h2>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <input v-model="form.title" type="text" placeholder="标题（可选）"
          class="w-full px-4 py-3 rounded-lg border border-sage-200 focus:outline-none focus:border-sage-500" />
      </div>

      <div>
        <textarea v-model="form.body" rows="8" placeholder="今天修行了什么？有什么感悟？" required
          class="w-full px-4 py-3 rounded-lg border border-sage-200 focus:outline-none focus:border-sage-500 resize-none"></textarea>
      </div>

      <!-- Mood selector -->
      <div>
        <p class="text-sm text-sage-500 mb-2">心情</p>
        <div class="flex gap-2 flex-wrap">
          <button v-for="m in moods" :key="m.value" type="button"
            @click="form.mood = form.mood === m.value ? null : m.value"
            class="px-3 py-1.5 rounded-full text-sm border transition-colors"
            :class="form.mood === m.value ? 'bg-sage-200 border-sage-400 text-sage-800' : 'bg-white border-sage-200 text-sage-600'">
            {{ m.label }}
          </button>
        </div>
      </div>

      <div>
        <label class="text-sm text-sage-500 mb-1 block">修行时长（分钟）</label>
        <input v-model.number="form.duration_minutes" type="number" min="0" max="600" placeholder="0"
          class="w-28 px-4 py-2 rounded-lg border border-sage-200 focus:outline-none focus:border-sage-500" />
      </div>

      <div>
        <label class="text-sm text-sage-500 mb-1 block">日期</label>
        <input v-model="form.practice_date" type="date"
          class="w-full px-4 py-2 rounded-lg border border-sage-200 focus:outline-none focus:border-sage-500" />
      </div>

      <!-- Link content -->
      <div>
        <p class="text-sm text-sage-500 mb-2">关联书库内容（可选）</p>
        <div v-if="contentsLoading" class="text-xs text-sage-400">加载中...</div>
        <div v-else class="space-y-1 max-h-40 overflow-y-auto">
          <label v-for="c in contents" :key="c.id"
            class="flex items-center gap-2 px-3 py-1.5 rounded hover:bg-sage-50 cursor-pointer">
            <input type="checkbox" :value="c.id" v-model="form.content_ids" class="rounded" />
            <span class="text-sm text-sage-700 truncate">{{ c.title }}</span>
            <span class="text-xs text-sage-400">{{ c.source }}</span>
          </label>
        </div>
        <p v-if="!contentsLoading && contents.length === 0" class="text-xs text-sage-400">书库中还没有内容</p>
      </div>

      <p v-if="error" class="text-vermilion-500 text-sm">{{ error }}</p>

      <button type="submit" :disabled="saving"
        class="w-full py-3 bg-sage-800 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50 font-serif transition-colors">
        {{ saving ? '保存中...' : '保存' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'

const route = useRoute()
const router = useRouter()
const api = useApi()
const isEdit = !!route.params.id

const moods = [
  { value: 'calm', label: '🧘 平静' },
  { value: 'energized', label: '⚡ 精力充沛' },
  { value: 'scattered', label: '🌫️ 散乱' },
  { value: 'peaceful', label: '🌿 安宁' },
  { value: 'tired', label: '😴 疲惫' },
]

const form = ref({
  title: '',
  body: '',
  mood: null,
  duration_minutes: null,
  practice_date: new Date().toISOString().slice(0, 10),
  content_ids: [],
})

const contents = ref([])
const contentsLoading = ref(true)
const saving = ref(false)
const error = ref('')

onMounted(async () => {
  const [contentRes] = await Promise.all([
    api.get('/contents?limit=100'),
    isEdit ? loadEntry() : Promise.resolve(),
  ])
  if (contentRes.data) contents.value = contentRes.data.items
  contentsLoading.value = false
})

async function loadEntry() {
  const { data } = await api.get(`/practices/${route.params.id}`)
  if (data) {
    form.value = {
      title: data.title || '',
      body: data.body,
      mood: data.mood,
      duration_minutes: data.duration_minutes,
      practice_date: data.practice_date,
      content_ids: data.linked_contents.map(c => c.id),
    }
  }
}

async function handleSubmit() {
  error.value = ''
  saving.value = true
  try {
    if (isEdit) {
      await api.put(`/practices/${route.params.id}`, form.value)
    } else {
      await api.post('/practices', form.value)
    }
    router.push('/practice')
  } catch (e) {
    error.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}
</script>
