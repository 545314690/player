import fs from 'node:fs'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
const exec=promisify(execFile),meta=JSON.parse(fs.readFileSync('docs/lyric-audio-review/metadata.json')).filter(x=>x.providerId),dir='docs/lyric-audio-review/provider'
fs.mkdirSync(dir,{recursive:true});let next=0,available=0
await Promise.all(Array.from({length:3},async()=>{while(next<meta.length){const row=meta[next++],path=`${dir}/${row.providerId}.json`;if(fs.existsSync(path))continue;try{const {stdout}=await exec('curl',['--connect-timeout','8','--max-time','20','-fsSL',`https://music.163.com/api/song/lyric?id=${row.providerId}&lv=-1&kv=-1&tv=-1`]);const doc=JSON.parse(stdout);fs.writeFileSync(path,JSON.stringify(doc));if(doc.lrc?.lyric&&!/暂无歌词|纯音乐|无歌词/.test(doc.lrc.lyric))available++;}catch(e){fs.writeFileSync(path,JSON.stringify({error:e.message.split('\n')[0]}))}}}))
console.log({recordings:meta.length,newLyrics:available})
