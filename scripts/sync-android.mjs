import {cp,mkdir,rm,readdir,stat} from 'node:fs/promises'
const target='android/app/src/main/assets/web'
await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true})
await cp('dist',target,{recursive:true,filter:src=>!/(?:^|\/)audio(?:\/|$)/.test(src)&&!src.endsWith('.mp3')&&!src.endsWith('.apk')})
const files=await readdir(target,{recursive:true})
if(files.some(f=>f.endsWith('.mp3')))throw Error('APK MUST NOT contain audio')
console.log(`Android web assets: ${files.length} entries; 0 audio files.`)
