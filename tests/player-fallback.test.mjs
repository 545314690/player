import test from 'node:test'
import assert from 'node:assert/strict'
import {createPlayer} from '../src/lib/player.js'
const settle=()=>new Promise(resolve=>setImmediate(resolve))
function setup(mode){
 const descriptors=Object.fromEntries(['window','navigator','Audio','MediaMetadata','document'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
 let instance
 class FakeAudio extends EventTarget {
  constructor(){super();instance=this;this.currentTime=0;this.duration=240;this.error=null;this.attempts=[];this.src=''}
  load(){if(!this.src)return;this.attempts.push(this.src);const fail=mode.failAll||(!mode.allowPrimary&&this.src.includes('zm.ysaw.top'))
   this.error=fail?{code:4}:null
   queueMicrotask(()=>{if(fail)this.dispatchEvent(new Event('error'));else{this.dispatchEvent(new Event('loadedmetadata'));this.dispatchEvent(new Event('canplay'))}})
  }
  play(){if(!this.error)queueMicrotask(()=>this.dispatchEvent(new Event('playing')));return Promise.resolve()}
  pause(){this.dispatchEvent(new Event('pause'))}
 }
 Object.defineProperty(globalThis,'window',{configurable:true,value:{}});Object.defineProperty(globalThis,'navigator',{configurable:true,value:mode.mediaSession?{mediaSession:mode.mediaSession}:{}});Object.defineProperty(globalThis,'Audio',{configurable:true,value:FakeAudio})
 Object.defineProperty(globalThis,'MediaMetadata',{configurable:true,value:class{constructor(fields){Object.assign(this,fields)}}});Object.defineProperty(globalThis,'document',{configurable:true,value:{baseURI:'https://test.local/player/'}})
 return {get audio(){return instance},restore(){for(const[k,d]of Object.entries(descriptors)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}}
}
const track={id:'s123456789abc',file:'测试歌曲.mp3',title:'测试歌曲',artist:'赞美诗集',cover:'artwork/meadow.png',src:'https://zm.ysaw.top/songs/assets/media/测试歌曲.mp3'}
test('A failed primary audio request falls back and keeps resume position without showing a final error',async()=>{
 const env=setup({allowPrimary:false}),errors=[];let engine
 try{engine=createPlayer(()=>{},()=>{},m=>errors.push(m));engine.load([track],track.id,45,true);await settle();await settle();assert.equal(env.audio.attempts.length,2);assert.match(env.audio.src,/raw\.githubusercontent/);assert.equal(env.audio.currentTime,45);assert.equal(engine.state.playing,true);assert.deepEqual(errors,[])}finally{engine?.destroy();env.restore()}
})
test('Retry after every source failed reloads the audio instead of calling play on a permanently failed resource',async()=>{
 const mode={failAll:true},env=setup(mode);let engine
 try{engine=createPlayer(()=>{},()=>{},()=>{});engine.load([track],track.id,0,true);await settle();await settle();assert.ok(engine.state.error);assert.equal(engine.state.playing,false);const attempts=env.audio.attempts.length;mode.failAll=false;mode.allowPrimary=true;engine.resume();await settle();assert.ok(env.audio.attempts.length>attempts);assert.match(env.audio.src,/zm\.ysaw\.top/);assert.equal(engine.state.playing,true);assert.equal(engine.state.error,'')}finally{engine?.destroy();env.restore()}
})

test('Playback engine cycles all tracks, repeats one only on end, and manual skips advance',async()=>{
 const env=setup({allowPrimary:true});let engine
 const tracks=Array.from({length:4},(_,i)=>({...track,id:'track'+i}))
 try{engine=createPlayer(()=>{},()=>{},()=>{});engine.load(tracks,'track0');await settle();
 for(let i=1;i<=4;i++){env.audio.dispatchEvent(new Event('ended'));await settle();assert.equal(engine.state.trackId,'track'+(i%4))}
 engine.mode('one',false);assert.equal(engine.state.nextTrackId,'track0');env.audio.dispatchEvent(new Event('ended'));await settle();assert.equal(engine.state.trackId,'track0');engine.next();await settle();assert.equal(engine.state.trackId,'track1');engine.previous();await settle();assert.equal(engine.state.trackId,'track0');
 engine.mode('list',true);const order=[...engine.state.orderIds];assert.equal(new Set(order).size,4);
 for(let i=1;i<4;i++){assert.equal(engine.state.nextTrackId,order[i]);env.audio.dispatchEvent(new Event('ended'));await settle();assert.equal(engine.state.trackId,order[i])}
 engine.previous();await settle();assert.equal(engine.state.trackId,order[2]);engine.next();await settle();assert.equal(engine.state.trackId,order[3]);engine.next();await settle();assert.equal(engine.state.trackId,order[0]);
 engine.replaceQueue(tracks,'track3');assert.equal(engine.state.nextTrackId,'track3');engine.next();await settle();assert.equal(engine.state.trackId,'track3');
 }finally{engine?.destroy();env.restore()}
})

test('Web lock-screen metadata follows timed lyrics after seek and clears during gaps',async()=>{
 const mediaSession={metadata:null,setActionHandler(){},setPositionState(){}},env=setup({allowPrimary:true,mediaSession});let engine
 try{engine=createPlayer(()=>{},()=>{},()=>{});engine.load([track],track.id,0,false);await settle();const lines=[{time:10,end:15,text:'第一句'},{time:20,end:25,text:'第二句'}];engine.seek(12);engine.lyrics(lines);assert.equal(mediaSession.metadata.artist,'第一句');engine.seek(17);engine.lyrics(lines);assert.equal(mediaSession.metadata.artist,track.artist);engine.seek(22);engine.lyrics(lines);assert.equal(mediaSession.metadata.artist,'第二句')}finally{engine?.destroy();env.restore()}
})
