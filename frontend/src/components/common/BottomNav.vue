<template>
  <nav class="fixed bottom-0 inset-x-0 bg-sage-50/95 backdrop-blur border-t border-sage-200 safe-bottom z-40">
    <div class="flex items-stretch max-w-lg mx-auto">
      <RouterLink v-for="item in navItems" :key="item.to" :to="item.to"
        class="flex flex-col items-center justify-center flex-1 py-1.5 text-xs transition-colors"
        :class="item.active ? 'text-sage-800' : 'text-sage-400'">
        <svg class="w-5 h-5 mb-0.5" :class="{ 'text-sage-700': item.active }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="item.icon" />
        </svg>
        <span>{{ item.label }}</span>
      </RouterLink>
    </div>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const icons = {
  home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  journal: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  library: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  lot: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z',
  music: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
}

const items = [
  { to: '/', label: '首页', key: 'home' },
  { to: '/practice', label: '日记', key: 'journal' },
  { to: '/library', label: '书库', key: 'library' },
  { to: '/draw-lot', label: '抽签', key: 'lot' },
  { to: '/white-noise', label: '白噪音', key: 'music' },
]

const navItems = computed(() => items.map(item => ({
  ...item,
  icon: icons[item.key],
  active: item.to === '/' ? route.path === '/' : route.path.startsWith(item.to),
})))
</script>
