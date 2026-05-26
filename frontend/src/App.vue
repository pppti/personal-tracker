<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 pb-20 safe-bottom">
      <router-view v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <BottomNav v-if="showNav" />
    <div v-if="offline" class="fixed top-12 inset-x-0 bg-vermilion-500 text-white text-center text-sm py-1 z-50">
      当前处于离线状态
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useOffline } from './composables/useOffline'
import AppHeader from './components/common/AppHeader.vue'
import BottomNav from './components/common/BottomNav.vue'

const { isOnline: offline } = useOffline()
const route = useRoute()

const showNav = computed(() => !['Login', 'Register'].includes(route.name))
</script>
