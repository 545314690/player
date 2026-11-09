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
  let audio
  const state={playing:false,loading:false,time:0,duration:0,trackId:null,error:''}
  const emit=patch=>{Object.assign(state,patch);onState({...state})}
  const native=()=>window.PraiseAndroid
  const nativeTracks=tracks=>JSON.stringify(tracks.map(({id,title,src,artist})=>({id,title,src,artist})))
  const updateMetadata=track=>{
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.artist,album:'赞美诗集',artwork:[{src:new URL(track.cover,document.baseURI).href,sizes:'1254x1254',type:'image/png'}]})
  }
  function webLoad(position=0,play=true) {
    const track=queue[index];if(!track)return
    emit({trackId:track.id,time:position,duration:0,loading:play,error:''});onTrack(track.id);updateMetadata(track)
    pendingPosition=position;audio.src=track.src;audio.load()
    if(play)audio.play().catch(e=>{if(e.name!=='AbortError')emit({playing:false,loading:false,error:'播放失败，请检查网络后重试。'})})
  }
  function step(direction=1,ended=false) {
    const next=nextIndex(queue,index,direction,repeat,shuffle,ended)
    if(next<0){audio?.pause();emit({playing:false});return}
    index=next;webLoad()
  }
  if (!isNative()) {
    audio=new Audio();audio.preload='metadata';audio.crossOrigin='anonymous'
    audio.addEventListener('loadedmetadata',()=>{if(pendingPosition>0)audio.currentTime=Math.min(pendingPosition,audio.duration||pendingPosition);pendingPosition=0;emit({duration:Number.isFinite(audio.duration)?audio.duration:0})})
    audio.addEventListener('timeupdate',()=>{
      emit({time:audio.currentTime,duration:Number.isFinite(audio.duration)?audio.duration:0})
      try{if(navigator.mediaSession && audio.duration>0)navigator.mediaSession.setPositionState({duration:audio.duration,playbackRate:1,position:Math.min(audio.currentTime,audio.duration)})}catch{}
    })
    audio.addEventListener('playing',()=>{emit({playing:true,loading:false,error:''});if(navigator.mediaSession)navigator.mediaSession.playbackState='playing'})
    audio.addEventListener('pause',()=>{emit({playing:false});if(navigator.mediaSession)navigator.mediaSession.playbackState='paused'})
    audio.addEventListener('waiting',()=>emit({loading:true}))
    audio.addEventListener('canplay',()=>emit({loading:false}))
    audio.addEventListener('ended',()=>step(1,true))
    audio.addEventListener('error',()=>{if(audio.src) {emit({playing:false,loading:false,error:'音频加载失败，请检查网络，或稍后重试。'});onError(state.error)}})
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
    load(tracks,id,position=0,autoplay=true){queue=tracks;index=Math.max(0,tracks.findIndex(t=>t.id===id))
      if(isNative()){native().loadQueue(nativeTracks(tracks),index,position,autoplay);onTrack(tracks[index]?.id);emit({trackId:tracks[index]?.id,time:position,error:'',loading:autoplay})}else webLoad(position,autoplay)
    },
    resume(){if(isNative())native().play();else if(audio.src)audio.play().catch(()=>onError('请再次点击播放，或检查音频网络。'))},
    pause(){if(isNative())native().pause();else audio.pause()},
    toggle(){state.playing?api.pause():api.resume()},
    seek(time){const v=Math.max(0,Math.min(Number(time)||0,state.duration||Number(time)||0));if(isNative())native().seek(v);else if(audio.src)audio.currentTime=v;emit({time:v})},
    next(){if(isNative())native().next();else step()},
    previous(){if(state.time>3){api.seek(0);return}if(isNative())native().previous();else step(-1)},
    volume(value){if(isNative())native().setVolume(value);else audio.volume=value},
    mode(r,s){repeat=r;shuffle=s;if(isNative())native().setMode(r,s)},
    sleep(minutes){clearTimeout(sleepTimer);if(isNative())native().setSleep(minutes);else if(minutes>0)sleepTimer=setTimeout(api.pause,minutes*60000)},
    replaceQueue(tracks){const id=state.trackId;queue=tracks;index=Math.max(0,queue.findIndex(t=>t.id===id));if(isNative())native().updateQueue(nativeTracks(tracks),index)},
    destroy(){clearInterval(nativeTimer);clearTimeout(sleepTimer);if(audio){audio.pause();audio.src=''}}
  }
  return api
}
