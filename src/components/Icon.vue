<script setup>
import {AudioLines,Music2,Disc3,Heart,History,Download,ListMusic,Plus,Settings2,ChevronRight,MonitorDown,WifiOff,LoaderCircle,ChevronDown,Search,SearchX,Play,Pause,SkipBack,SkipForward,Shuffle,Repeat,Repeat1,Ellipsis,ArrowUp,ArrowDown,CircleCheck,UserRound,Palette,Upload,HardDrive,Type,SlidersHorizontal,PencilLine,LocateFixed,FileMusic,X,ListPlus,ListStart,HardDriveDownload,ListMinus,Moon,Pencil,Trash2,Info,Minus,XCircle} from 'lucide-vue-next'
const icons={AudioLines,Music2,Disc3,Heart,History,Download,ListMusic,Plus,Settings2,ChevronRight,MonitorDown,WifiOff,LoaderCircle,ChevronDown,Search,SearchX,Play,Pause,SkipBack,SkipForward,Shuffle,Repeat,Repeat1,Ellipsis,ArrowUp,ArrowDown,CircleCheck,UserRound,Palette,Upload,HardDrive,Type,SlidersHorizontal,PencilLine,LocateFixed,FileMusic,X,ListPlus,ListStart,HardDriveDownload,ListMinus,Moon,Pencil,Trash2,Info,Minus,XCircle}
defineProps({name:String,size:{type:[Number,String],default:20}})
</script>
<template><component :is="icons[name] || Music2" :size="size" :stroke-width="1.7" aria-hidden="true" /></template>
