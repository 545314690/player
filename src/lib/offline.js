import {isNative} from './player.js'
export const AUDIO_CACHE='praise-audio-v1'
export async function downloadedIds(catalog) {
  if(isNative())return JSON.parse(window.PraiseAndroid.getDownloads()).complete
  if(!('caches' in window))return []
  const cache=await caches.open(AUDIO_CACHE),keys=await cache.keys(),urls=new Set(keys.map(k=>k.url))
  return catalog.filter(t=>urls.has(new URL(t.src,location.href).href)).map(t=>t.id)
}
export async function downloadTrack(track) {
  if(isNative()){
    window.PraiseAndroid.download(track.id,track.src)
    await new Promise((resolve,reject)=>{const timer=setInterval(()=>{let status;try{status=JSON.parse(window.PraiseAndroid.getDownloads())}catch{return}
      if(status.complete.includes(track.id)){clearInterval(timer);resolve()}
      if(status.errors?.[track.id]){clearInterval(timer);reject(new Error(status.errors[track.id]))}
    },500)})
    return
  }
  if(!('caches'in window)||!navigator.serviceWorker?.controller)throw new Error('离线下载需要 HTTPS 或本机地址，并等待离线服务就绪。')
  const response=await fetch(track.src,{mode:'cors'})
  if(!response.ok)throw new Error('歌曲下载失败，请检查网络。')
  const cache=await caches.open(AUDIO_CACHE)
  await cache.put(track.src,response)
  try{await navigator.storage?.persist()}catch{}
}
export async function removeDownload(track) {
  if(isNative()){window.PraiseAndroid.removeDownload(track.id);return}
  await (await caches.open(AUDIO_CACHE)).delete(track.src)
}
