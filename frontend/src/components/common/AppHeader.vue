<template>
  <header class="sticky top-0 bg-sage-50/90 backdrop-blur border-b border-sage-200 z-40">
    <div class="flex items-center justify-between px-4 h-12">
      <button v-if="showBack" @click="goBack" class="text-sage-700 p-1 -ml-1">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <div v-else class="w-7" />
      <h1 class="text-base font-serif font-bold text-sage-900">{{ title }}</h1>
      <div class="w-7" />
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const showBack = computed(() => {
  const name = route.name
  return name && !['Home', 'Login', 'Register'].includes(name)
})

const titles = {
  Home: '修行记录',
  Login: '登录',
  Register: '注册',
  PracticeList: '修行日记',
  PracticeNew: '新增日记',
  PracticeEdit: '编辑日记',
  PracticeDetail: '日记详情',
  Library: '书库',
  ContentImport: '导入内容',
  ContentDetail: '内容详情',
  DrawLot: '抽签',
  WhiteNoise: '白噪音',
  Messages: '修行寄语',
  Settings: '设置',
}
const title = computed(() => titles[route.name] || '修行记录')

function goBack() {
  router.back()
}
</script>
