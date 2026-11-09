<script setup>
import {ref,computed,watch,nextTick,onMounted,onBeforeUnmount} from 'vue'
import {activeLine} from '../lib/lyrics.js'
import Icon from './Icon.vue'
const props=defineProps({lines:Array,time:Number,offset:Number,fontSize:Number,trackId:String})
const emit=defineEmits(['seek','edit','calibrate','font'])
const viewport=ref(),follow=ref(true),index=computed(()=>activeLine(props.lines,props.time,props.offset)),lineEls=new Map()
let observer
function center(instant=false){if(!follow.value)return; const el=lineEls.get(index.value);if(!el||!viewport.value)return
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
  viewport.value.scrollTo({top:el.offsetTop-viewport.value.clientHeight/2+el.offsetHeight/2,behavior:instant||reduced?'instant':'smooth'})
}
function resume(){follow.value=true;nextTick(()=>center())}
watch(index,()=>nextTick(()=>center()))
watch(()=>[props.lines,props.fontSize,props.trackId],async()=>{await nextTick();center(true)},{deep:true})
watch(()=>props.trackId,()=>{follow.value=true;lineEls.clear()})
onMounted(()=>{observer=new ResizeObserver(()=>center(true));observer.observe(viewport.value)})
onBeforeUnmount(()=>observer?.disconnect())
</script>
<template>
  <div class="lyrics-component">
    <div ref="viewport" class="lyrics-scroll" :style="{'--lyric-size':fontSize+'px'}" tabindex="0" aria-label="同步歌词，点击一句可跳转播放" @wheel.passive="follow=false" @touchstart.passive="follow=false" @keydown="['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes($event.key)&&(follow=false)">
      <div v-if="lines.length" class="lyrics-lines">
        <button v-for="(line,i) in lines" :key="trackId+'-'+i" :ref="el=>el?lineEls.set(i,el):lineEls.delete(i)" class="lyric-line" :class="{current:i===index}" :aria-current="i===index?'true':undefined" :aria-label="line.text+'，跳转到 '+Math.floor(line.time)+' 秒'" @click="emit('seek',line.time+(offset||0));resume()">{{line.text}}</button>
      </div>
      <div v-else class="empty compact"><Icon name="FileMusic" :size="30"/><p>这首歌还没有同步歌词</p><small>可查看完整文本，或自行添加时间轴。</small></div>
    </div>
    <button v-if="!follow" class="follow-button" @click="resume"><Icon name="LocateFixed" :size="15"/>回到当前句</button>
    <div class="lyric-tools"><button @click="emit('font')"><Icon name="Type" :size="16"/>字号</button><button @click="emit('calibrate')"><Icon name="SlidersHorizontal" :size="16"/>校准</button><button @click="emit('edit')"><Icon name="PencilLine" :size="16"/>纠错</button></div>
  </div>
</template>
