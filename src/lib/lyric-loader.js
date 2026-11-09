/** Native and PWA both prefer the last fetched remote lyric, with bundled repairs as fallback. */
export function applyKnownRepairs(remote, original, repaired) {
  const before=(original||'').split(/\r?\n/),after=(repaired||'').split(/\r?\n/),patches=new Map()
  before.forEach((line,i)=>{if(after[i]!==undefined&&after[i]!==line)patches.set(line,after[i])})
  return remote.split(/\r?\n/).map(line=>patches.get(line)??line).join('\n')
}
export async function refreshRemoteLyrics(track,doc,signal){
  if(!track.lrc)return doc
  const key=track.lrc, cache='caches'in window?await caches.open('praise-lyrics-v1'):null
  let cached=await cache?.match(key)
  const finish=async response=>({...doc,lrc:applyKnownRepairs(await response.text(),doc.original,doc.lrc)})
  const controller=new AbortController(),abort=()=>controller.abort()
  signal.addEventListener('abort',abort,{once:true})
  const timer=setTimeout(abort,6000)
  try{
    const response=await fetch(key,{signal:controller.signal,mode:'cors'})
    if(!response.ok)throw Error('歌词服务暂不可用')
    const text=await response.clone().text()
    if(!/\[\d{1,3}:\d{2}/.test(text))throw Error('无效歌词')
    await cache?.put(key,response.clone())
    return await finish(response)
  }catch{if(signal.aborted)throw new DOMException('Aborted','AbortError');return cached?await finish(cached):doc}
  finally{clearTimeout(timer);signal.removeEventListener('abort',abort)}
}
