import test from 'node:test'
import assert from 'node:assert/strict'
import {createPlayer} from '../src/lib/player.js'
const settle=()=>new Promise(resolve=>setImmediate(resolve))
function setup(mode){
 const descriptors=Object.fromEntries(['window','navigator','Audio'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]))
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
 Object.defineProperty(globalThis,'window',{configurable:true,value:{}});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});Object.defineProperty(globalThis,'Audio',{configurable:true,value:FakeAudio})
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
