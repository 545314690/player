import {isNative} from './player.js'
import {audioSources,sameAudioFile} from './audio-sources.js'
export const AUDIO_CACHE='praise-audio-v1'
export async function downloadedIds(catalog) {
  if(isNative())return JSON.parse(window.PraiseAndroid.getDownloads()).complete
  if(!('caches' in window))return []
  try{const cache=await caches.open(AUDIO_CACHE),keys=await cache.keys(),urls=new Set(keys.map(k=>k.url));return catalog.filter(t=>[...urls].some(url=>sameAudioFile(url,t.src))).map(t=>t.id)}catch{return []}
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
  const cache=await caches.open(AUDIO_CACHE)
  for(const key of await cache.keys())if(sameAudioFile(key.url,track.src))return
  let response
  for(const source of audioSources(track)){try{const candidate=await fetch(source,{mode:'cors'});if(candidate.status===200&&!/text\/html/i.test(candidate.headers.get('content-type')||'')){response=candidate;break}}catch{}}
  if(!response)throw new Error('歌曲下载失败，主线路和备用线路均不可用。')
  await cache.put(track.src,response)
  try{await navigator.storage?.persist()}catch{}
}
export async function removeDownload(track) {
  if(isNative()){window.PraiseAndroid.removeDownload(track.id);return}
  const cache=await caches.open(AUDIO_CACHE);for(const key of await cache.keys())if(sameAudioFile(key.url,track.src))await cache.delete(key)
}
