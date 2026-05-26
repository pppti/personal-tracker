<template>
  <div class="px-4 py-4">
    <h2 class="font-serif font-bold text-sage-800 mb-4">导入内容</h2>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div>
        <input v-model="form.title" type="text" placeholder="标题（如：道德经·第八章）" required
          class="w-full px-4 py-3 rounded-lg border border-sage-200 focus:outline-none focus:border-sage-500" />
      </div>

      <div>
        <select v-model="form.category" class="w-full px-4 py-3 rounded-lg border border-sage-200 bg-white text-sage-700">
          <option value="quote">语录</option>
          <option value="passage">段落</option>
          <option value="sutra">经文</option>
          <option value="classic">经典</option>
          <option value="book">书籍</option>
          <option value="verse">诗词</option>
        </select>
      </div>

      <div>
        <input v-model="form.source" type="text" placeholder="出处（如：老子·道德经）"
          class="w-full px-4 py-3 rounded-lg border border-sage-200 focus:outline-none focus:border-sage-500" />
      </div>

      <div>
        <textarea v-model="form.body" rows="8" placeholder="正文内容..." required
          class="w-full px-4 py-3 rounded-lg border border-sage-200 focus:outline-none focus:border-sage-500 resize-none"></textarea>
      </div>

      <div>
        <textarea v-model="form.notes" rows="3" placeholder="个人笔记（可选）"
          class="w-full px-4 py-3 rounded-lg border border-sage-200 focus:outline-none focus:border-sage-500 resize-none"></textarea>
      </div>

      <!-- Tags -->
      <div>
        <p class="text-sm text-sage-500 mb-2">标签</p>
        <div class="flex gap-2 flex-wrap">
          <label v-for="tag in tags" :key="tag.id" class="flex items-center gap-1 text-sm text-sage-600">
            <input type="checkbox" :value="tag.id" v-model="form.tag_ids" class="rounded" />
            {{ tag.name }}
          </label>
        </div>
        <div class="flex gap-2 mt-2">
          <input v-model="newTagName" @keyup.enter.prevent="addTag" placeholder="新建标签"
            class="flex-1 px-3 py-1.5 text-sm rounded-lg border border-sage-200 focus:outline-none focus:border-sage-500" />
          <button type="button" @click="addTag" :disabled="!newTagName.trim()"
            class="px-3 py-1.5 text-sm bg-sage-200 text-sage-700 rounded-lg hover:bg-sage-300 disabled:opacity-50">
            添加
          </button>
        </div>
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
import { useRouter } from 'vue-router'
import { useApi } from '../composables/useApi'

const router = useRouter()
const api = useApi()
const tags = ref([])
const newTagName = ref('')
const saving = ref(false)
const error = ref('')

const form = ref({
  title: '',
  category: 'quote',
  source: '',
  body: '',
  notes: '',
  tag_ids: [],
})

async function addTag() {
  const name = newTagName.value.trim()
  if (!name) return
  const { data, error: err } = await api.post('/tags', { name })
  if (data) {
    tags.value.push(data)
    form.value.tag_ids.push(data.id)
    newTagName.value = ''
  }
}

async function handleSubmit() {
  error.value = ''
  saving.value = true
  try {
    await api.post('/contents', form.value)
    router.push('/library')
  } catch (e) {
    error.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const { data } = await api.get('/tags')
  if (data) tags.value = data
})
</script>
