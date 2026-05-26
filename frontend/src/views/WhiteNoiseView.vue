<template>
  <div class="px-4 py-4">
    <div class="text-center mb-6">
      <h2 class="font-serif font-bold text-sage-800 text-xl mb-1">白噪音</h2>
      <p class="text-sm text-sage-500">以自然之声，洗涤尘心</p>
    </div>

    <div v-if="loading" class="text-center text-sage-400 py-6">加载中...</div>
    <EmptyState v-else-if="trackList.length === 0" text="没有可用的音轨" />

    <!-- Track list -->
    <div v-else class="space-y-3">
      <div v-for="track in trackList" :key="track.id"
        class="bg-white rounded-xl p-4 border border-sage-100 transition-colors"
        :class="{ 'border-sage-400 shadow-sm': activeTracks[track.id]?.playing }">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-sage-800">{{ track.name_cn || track.name }}</p>
            <p class="text-xs text-sage-400">{{ categoryNames[track.category] || track.category }}</p>
          </div>
          <div class="flex items-center gap-3">
            <!-- Volume -->
            <input v-if="activeTracks[track.id]" type="range" min="0" max="1" step="0.05"
              :value="activeTracks[track.id].volume"
              @input="setVolume(track.id, $event.target.value)"
              class="w-16 h-1 accent-sage-600" />
            <!-- Play/Pause -->
            <button @click="togglePlay(track)"
              class="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
              :class="activeTracks[track.id]?.playing ? 'bg-sage-200 text-sage-700' : 'bg-sage-800 text-white'">
              <svg v-if="activeTracks[track.id]?.playing" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
              <svg v-else class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Stop all -->
      <button v-if="anyPlaying" @click="stopAll"
        class="w-full mt-4 py-3 border border-sage-400 text-sage-700 rounded-lg text-sm hover:bg-sage-100 transition-colors">
        停止全部
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useApi } from '../composables/useApi'
import { useAudio } from '../composables/useAudio'
import EmptyState from '../components/common/EmptyState.vue'

const api = useApi()
const audio = useAudio()
const trackList = ref([])
const loading = ref(true)

const categoryNames = { rain: '雨', water: '水', bell: '钟', bowl: '钵', wind: '风', thunder: '雷' }

const activeTracks = computed(() => {
  const map = {}
  audio.tracks.value.forEach(t => {
    map[t.id] = { playing: t.playing.value, volume: t.volume.value }
  })
  return map
})

const anyPlaying = computed(() => audio.tracks.value.some(t => t.playing.value))

function togglePlay(track) {
  if (!activeTracks.value[track.id]) {
    audio.addTrack(track)
  }
  audio.togglePlay(track.id)
}

function setVolume(trackId, vol) {
  audio.setVolume(trackId, parseFloat(vol))
}

function stopAll() {
  audio.stopAll()
}

onMounted(async () => {
  const { data } = await api.get('/white-noise/tracks')
  if (data) trackList.value = data
  loading.value = false
})
</script>
