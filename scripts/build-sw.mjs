import {readdir,writeFile,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {byteRange} from '../src/lib/range.js'
import {sameAudioFile} from '../src/lib/audio-sources.js'
const all=await readdir('dist',{recursive:true})
const paths=all.filter(p=>/\.(?:html|js|css|json|png|webp|svg|webmanifest)$/.test(p)&&p!=='sw.js'&&p!=='artwork/meadow.png'&&!p.startsWith('audio/')).map(p=>'./'+p)
const hash=createHash('sha256');for(const p of paths)hash.update(await readFile('dist/'+p.slice(2)))
const version=hash.digest('hex').slice(0,12)
const sw=`const SHELL='praise-shell-${version}', AUDIO='praise-audio-v1';
const FILES=${JSON.stringify(paths)};
const byteRange=${byteRange.toString()};
const sameAudioFile=${sameAudioFile.toString()};
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(FILES)).catch(()=>{}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('praise-shell-')&&k!==SHELL).map(k=>caches.delete(k)))).catch(()=>{}).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 if(/\\.mp3$/i.test(u.pathname)){
   e.respondWith((async()=>{
     try{
       const cache=await caches.open(AUDIO);let cached=await cache.match(e.request.url);
       if(!cached){const keys=await cache.keys();const alias=keys.find(k=>sameAudioFile(k.url,e.request.url));if(alias)cached=await cache.match(alias);}
       if(cached){
         const range=e.request.headers.get('range');if(!range)return cached;
         const body=await cached.arrayBuffer(), r=byteRange(range,body.byteLength);
         if(!r)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+body.byteLength}});
         return new Response(body.slice(r.start,r.end+1),{status:206,headers:{'Content-Type':cached.headers.get('Content-Type')||'audio/mpeg','Accept-Ranges':'bytes','Content-Range':'bytes '+r.start+'-'+r.end+'/'+body.byteLength,'Content-Length':String(r.end-r.start+1)}});
       }
     }catch{ /* Cache unavailable in private/restricted storage: online playback must still work. */ }
     return fetch(e.request);
   })());return;
 }
 if(u.origin!==self.location.origin)return;
 if(e.request.mode==='navigate'){
  e.respondWith(fetch(e.request).catch(()=>caches.open(SHELL).then(c=>c.match('./index.html'))));return;
 }
 e.respondWith((async()=>{try{const c=await caches.open(SHELL),hit=await c.match(e.request,{ignoreSearch:true});if(hit)return hit}catch{}return fetch(e.request)})());
});`
await writeFile('dist/sw.js',sw)
console.log(`PWA: ${paths.length} shell and lyric files; version ${version}. Audio is never precached.`)
