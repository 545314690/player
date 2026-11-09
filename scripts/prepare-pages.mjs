import {access,cp,mkdir,readdir,rm,unlink} from 'node:fs/promises'
import {readFile} from 'node:fs/promises'
const {version}=JSON.parse(await readFile('package.json','utf8'))
const apk=`output/赞美诗-${version}-debug.apk`
// Validate the new build exists before replacing the published package.
await access('dist/index.html');await access(apk)
await rm('web-dist',{recursive:true,force:true})
await cp('dist','web-dist',{recursive:true,filter:p=>!p.endsWith('.apk')})
await mkdir('web-dist/downloads',{recursive:true})
await cp(apk,`web-dist/downloads/praise-player-${version}.apk`)
for(const file of await readdir('output'))if(/^赞美诗-\d+\.\d+\.\d+-debug\.apk$/.test(file)&&file!==`赞美诗-${version}-debug.apk`)await unlink('output/'+file)
console.log(`Pages package prepared; only APK v${version} retained.`)
