import fs from 'node:fs'
import {parseLrc,serializeLrc} from '../../src/lib/lyrics.js'
export function fromPublishedLrc(raw,duration,offset=0){
 const lines=parseLrc(raw).map(x=>({...x,time:Math.round((x.time-offset)*1000)/1000})).filter(x=>x.time>=0&&x.time<duration&&!/LRC制作|www\.|演唱[：:]|专辑[：:]|作词[：:]|作曲[：:]|词[：:]|曲[：:]|^《/.test(x.text))
 const segments=lines.map((x,i)=>({time:x.time,end:lines[i+1]?.time??duration,text:/music|间奏|前奏|尾奏/i.test(x.text)?'':x.text,...(/music|间奏|前奏|尾奏/i.test(x.text)?{kind:'instrumental'}:{})}))
 return {syncSegments:segments,lrc:serializeLrc(segments.filter(x=>x.text)),canonical:[...new Set(segments.filter(x=>x.text).map(x=>x.text))],syncCoverage:1,reviewNeeded:false}
}
