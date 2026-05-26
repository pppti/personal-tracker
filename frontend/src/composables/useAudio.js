import { ref, shallowRef } from 'vue'

const tracks = ref([])
const audioContext = shallowRef(null)

function getContext() {
  if (!audioContext.value) {
    audioContext.value = new AudioContext()
  }
  return audioContext.value
}

export function useAudio() {
  function addTrack(trackData) {
    const existing = tracks.value.find(t => t.id === trackData.id)
    if (existing) return existing

    const audio = new Audio()
    audio.src = `/api/white-noise/stream/${trackData.id}`
    audio.loop = true
    audio.crossOrigin = 'anonymous'

    const ctx = getContext()
    const source = ctx.createMediaElementSource(audio)
    const gainNode = ctx.createGain()
    gainNode.gain.value = 0.5
    source.connect(gainNode)
    gainNode.connect(ctx.destination)

    const entry = {
      id: trackData.id,
      name: trackData.name_cn || trackData.name,
      category: trackData.category,
      audio,
      gainNode,
      playing: ref(false),
      volume: ref(0.5),
    }

    entry.audio.addEventListener('ended', () => {
      if (entry.audio.loop) entry.audio.play()
    })

    tracks.value.push(entry)
    return entry
  }

  function removeTrack(id) {
    const idx = tracks.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const entry = tracks.value[idx]
    entry.audio.pause()
    entry.audio.src = ''
    entry.gainNode.disconnect()
    tracks.value.splice(idx, 1)
  }

  function togglePlay(id) {
    const entry = tracks.value.find(t => t.id === id)
    if (!entry) return
    if (entry.audio.paused) {
      entry.audio.play()
      entry.playing.value = true
    } else {
      entry.audio.pause()
      entry.playing.value = false
    }
  }

  function setVolume(id, vol) {
    const entry = tracks.value.find(t => t.id === id)
    if (!entry) return
    entry.gainNode.gain.value = vol
    entry.volume.value = vol
  }

  function stopAll() {
    tracks.value.forEach(t => {
      t.audio.pause()
      t.playing.value = false
    })
    tracks.value = []
  }

  return { tracks, addTrack, removeTrack, togglePlay, setVolume, stopAll }
}
