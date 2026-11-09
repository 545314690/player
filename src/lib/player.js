import {audioSources} from './audio-sources.js'
export const isNative = () => typeof window.PraiseAndroid !== 'undefined'
export function nextIndex(queue, index, direction, repeat, shuffle, ended = false) {
  if (!queue.length) return -1
  if (ended && repeat === 'one') return index
  if (shuffle && queue.length > 1) { const candidates=queue.map((_,i)=>i).filter(i=>i!==index);return candidates[Math.floor(Math.random()*candidates.length)] }
  const n=index+direction
  return n>=queue.length ? (repeat==='off'&&ended?-1:0) : n<0?queue.length-1:n
}
export function createPlayer(onState, onTrack, onError) {
  let queue=[], index=0, repeat='list', shuffle=false, sleepTimer, nativeTimer, pendingPosition=0, loading=false
  let order=[], cursor=0
  let audio, candidates=[], sourceIndex=0, shouldPlay=false, generation=0, stalledTimer
  const state={playing:false,loading:false,time:0,duration:0,trackId:null,nextTrackId:null,orderIds:[],mode:'list',sleepUntil:0,error:''}
  const emit=patch=>{Object.assign(state,patch);onState({...state})}
  const native=()=>window.PraiseAndroid
  const nativeTracks=tracks=>JSON.stringify(tracks.map(({id,title,src,artist})=>({id,title,src,artist})))
  const updateMetadata=track=>{
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.artist,album:'赞美诗集',artwork:[{src:new URL(track.cover,document.baseURI).href,sizes:'768x768',type:'image/webp'}]})
  }
  function rebuildOrder(pinId=null){
    order=queue.map((_,i)=>i)
    if(shuffle){
      const rest=order.filter(i=>i!==index)
      for(let i=rest.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]]}
      order=[index,...rest]
    }
    cursor=Math.max(0,order.indexOf(index))
    const pin=queue.findIndex(t=>t.id===pinId)
    if(pin>=0&&pin!==index){order=order.filter(i=>i!==pin);cursor=order.indexOf(index);order.splice(cursor+1,0,pin)}
  }
  function orderState(){
    const upcoming=repeat==='one'?index:order[nextIndex(order,cursor,1,repeat,false,true)]
    return {mode:repeat==='one'?'one':shuffle?'shuffle':'list',orderIds:order.map(i=>queue[i]?.id).filter(Boolean),nextTrackId:queue[upcoming]?.id||null}
  }
  function clearStall(){clearTimeout(stalledTimer)}
  function failed(){clearStall();emit({playing:false,loading:false,error:'音频加载失败，已尝试主线路和备用线路。请点击重试。'});onError(state.error)}
  function armStall(){clearStall();if(shouldPlay)stalledTimer=setTimeout(()=>fallback(),18000)}
  function fallback(){
    if(sourceIndex+1>=candidates.length){failed();return}
    const position=audio.currentTime||pendingPosition||state.time||0
    sourceIndex++;loadSource(position,shouldPlay)
  }
  function loadSource(position,play){
    const attempt=++generation;shouldPlay=play;pendingPosition=position
    emit({time:position,loading:play,error:''})
    audio.src=candidates[sourceIndex];audio.load();armStall()
    if(play)audio.play().catch(e=>{
      if(attempt!==generation||e.name==='AbortError')return
      if(e.name==='NotAllowedError'){clearStall();shouldPlay=false;emit({playing:false,loading:false,error:'浏览器尚未允许播放，请再点击一次播放。'})}
      // Media load failures are handled once by the audio error event.
    })
  }
  function webLoad(position=0,play=true) {
    const track=queue[index];if(!track)return
    clearStall();candidates=audioSources(track);sourceIndex=0
    emit({trackId:track.id,time:position,duration:0,loading:play,error:''});onTrack(track.id);updateMetadata(track);emit(orderState())
    loadSource(position,play)
  }
  function step(direction=1,ended=false) {
    const next=nextIndex(order,cursor,direction,repeat,false,ended)
    if(next<0){audio?.pause();emit({playing:false});return}
    cursor=next;index=order[cursor];webLoad()
  }
  if (!isNative()) {
    audio=new Audio();audio.preload='metadata';audio.crossOrigin='anonymous'
    audio.addEventListener('loadedmetadata',()=>{if(pendingPosition>0)audio.currentTime=Math.min(pendingPosition,audio.duration||pendingPosition);pendingPosition=0;emit({duration:Number.isFinite(audio.duration)?audio.duration:0})})
    audio.addEventListener('timeupdate',()=>{
      emit({time:audio.currentTime,duration:Number.isFinite(audio.duration)?audio.duration:0})
      try{if(navigator.mediaSession && audio.duration>0)navigator.mediaSession.setPositionState({duration:audio.duration,playbackRate:1,position:Math.min(audio.currentTime,audio.duration)})}catch{}
    })
    audio.addEventListener('playing',()=>{clearStall();emit({playing:true,loading:false,error:''});if(navigator.mediaSession)navigator.mediaSession.playbackState='playing'})
    audio.addEventListener('pause',()=>{emit({playing:false});if(navigator.mediaSession)navigator.mediaSession.playbackState='paused'})
    audio.addEventListener('waiting',()=>{emit({loading:true});armStall()})
    audio.addEventListener('canplay',()=>{clearStall();emit({loading:false})})
    audio.addEventListener('ended',()=>step(1,true))
    audio.addEventListener('error',()=>{if(audio.src)fallback()})
    if ('mediaSession' in navigator) {
      const handlers={play:()=>api.resume(),pause:()=>api.pause(),previoustrack:()=>api.previous(),nexttrack:()=>api.next(),seekto:d=>api.seek(d.seekTime),seekbackward:d=>api.seek(state.time-(d.seekOffset||10)),seekforward:d=>api.seek(state.time+(d.seekOffset||10)),stop:()=>api.pause()}
      for(const [action,handler]of Object.entries(handlers))try{navigator.mediaSession.setActionHandler(action,handler)}catch{}
    }
  } else {
    nativeTimer=setInterval(()=>{
      try { const s=JSON.parse(native().getState());if(!s.trackId)return
        if(s.trackId!==state.trackId){onTrack(s.trackId);index=queue.findIndex(t=>t.id===s.trackId)}
        emit(s)
      } catch{}
    },400)
  }
  const api={
    get state(){return state},
    load(tracks,id,position=0,autoplay=true){if(!tracks.length){api.pause();return}queue=tracks;index=Math.max(0,tracks.findIndex(t=>t.id===id));rebuildOrder()
      if(isNative()){native().loadQueue(nativeTracks(tracks),index,position,autoplay);onTrack(tracks[index]?.id);emit({trackId:tracks[index]?.id,time:position,error:'',loading:autoplay,nextTrackId:null,orderIds:[]})}else webLoad(position,autoplay)
    },
    resume(){if(isNative())native().play();else if(audio.src){shouldPlay=true;if(audio.error||state.error){sourceIndex=0;loadSource(state.time,true)}else{armStall();audio.play().catch(()=>{clearStall();onError('请再次点击播放，或检查音频网络。')})}}},
    pause(){shouldPlay=false;clearStall();if(isNative())native().pause();else audio.pause()},
    toggle(){state.playing?api.pause():api.resume()},
    seek(time){const v=Math.max(0,Math.min(Number(time)||0,state.duration||Number(time)||0));if(isNative())native().seek(v);else if(audio.src)audio.currentTime=v;emit({time:v})},
    next(){if(isNative())native().next();else step()},
    previous(){if(state.time>3){api.seek(0);return}if(isNative())native().previous();else step(-1)},
    volume(value){if(isNative())native().setVolume(value);else audio.volume=value},
    lyrics(lines,offset=0,revision='',custom=false){if(isNative())native().setLyrics(state.trackId,JSON.stringify(lines),offset,revision,custom);else if(navigator.mediaSession?.metadata){const line=lines.findLast(x=>x.time<=state.time-offset&&(!Number.isFinite(x.end)||state.time-offset<x.end));navigator.mediaSession.metadata.artist=line?.text||queue[index]?.artist||'赞美诗集'}},
    mode(r,s){const changed=shuffle!==s;repeat=r;shuffle=s;if(isNative())native().setMode(r,s);else{if(changed)rebuildOrder();emit(orderState())}},
    sleep(minutes){clearTimeout(sleepTimer);const sleepUntil=minutes>0?Date.now()+minutes*60000:0;emit({sleepUntil});if(isNative())native().setSleep(minutes);else if(minutes>0)sleepTimer=setTimeout(()=>{api.pause();emit({sleepUntil:0})},minutes*60000)},
    replaceQueue(tracks,pinId=null){const id=state.trackId;queue=tracks;index=Math.max(0,queue.findIndex(t=>t.id===id));rebuildOrder(pinId);if(isNative())native().updateQueue(nativeTracks(tracks),index,pinId||'');else emit(orderState())},
    destroy(){clearStall();generation++;clearInterval(nativeTimer);clearTimeout(sleepTimer);if(audio){audio.pause();audio.src=''}}
  }
  return api
}
