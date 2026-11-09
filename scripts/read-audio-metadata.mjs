import fs from 'node:fs'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createDecipheriv} from 'node:crypto'
const execute=promisify(execFile),catalog=JSON.parse(fs.readFileSync('static/library/catalog.json')),rows=[]
let next=0
await Promise.all(Array.from({length:4},async()=>{while(next<catalog.length){const t=catalog[next++];try{const {stdout}=await execute('ffprobe',['-v','error','-show_entries','format_tags=title,artist,album,comment','-of','json',process.argv[2]+'/'+t.file]);const tags=JSON.parse(stdout).format?.tags||{},row={id:t.id,file:t.file,title:tags.title,artist:tags.artist,album:tags.album};const comment=tags.comment||'';if(comment.startsWith("163 key(Don't modify):")){const decipher=createDecipheriv('aes-128-ecb',Buffer.from('2331346c6a6b5f215c5d2630553c2728','hex'),null);const decoded=Buffer.concat([decipher.update(Buffer.from(comment.split(':').slice(1).join(':'),'base64')),decipher.final()]).toString();const music=JSON.parse(decoded.replace(/^music:/,''));row.providerId=music.musicId;row.providerTitle=music.musicName;row.providerDuration=music.duration;row.providerArtist=music.artist?.map(x=>x[0]);}rows.push(row)}catch(e){rows.push({id:t.id,file:t.file,error:e.message.split('\n')[0]})}}}))
rows.sort((a,b)=>catalog.findIndex(t=>t.id===a.id)-catalog.findIndex(t=>t.id===b.id));fs.writeFileSync('docs/lyric-audio-review/metadata.json',JSON.stringify(rows,null,2));console.log({tracks:rows.length,providerIDs:rows.filter(x=>x.providerId).length});console.log(rows.find(x=>x.id==='s7d549dc98ab9'))
