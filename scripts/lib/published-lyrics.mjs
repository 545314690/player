import {parseLrc,serializeLrc} from '../../src/lib/lyrics.js'
export function fromPublishedLrc(raw,duration,offset=0,scale=1,metadata={}){
 // An empty timed cue is an intentional end to the preceding vocal line.
 const withGaps=raw.replace(/^((?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+)\s*$/gm,'$1Music')
 const key=s=>s.replace(/[^\p{Script=Han}A-Za-z0-9]/gu,'').toLowerCase()
 const album=metadata.plain?.match(/^专辑[：:](.+)/m)?.[1]?.trim()
 const title=metadata.plain?.match(/^歌名[：:](.+)/m)?.[1]?.trim(),artist=metadata.plain?.match(/^音乐人[：:](.+)/m)?.[1]?.trim()
 const isHeader=text=>!!(title&&artist&&key(text)===key(title+artist))
 const body=(metadata.plain||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!/^(?:歌名|专辑|音乐人|演唱|词|曲|系列|编号|LRC|QQ|点击听歌)/i.test(x))
 const firstBody=body[0]||''
 const extraHeader=x=>!!(x.time<20&&[artist,album].some(name=>name&&key(name).length>=2&&key(x.text)===key(name)&&key(name)!==key(title||'')&&!body.some(line=>key(line).includes(key(name)))))
 const numberedTitle=x=>!!(x.time<20&&title&&/^\d{1,4}/.test(x.text)&&key(x.text.replace(/^\d{1,4}\s*/,''))===key(title.replace(/^\d{1,4}\s*/,'')))
 const initial=parseLrc(withGaps).slice(0,12)
 const boundary=Math.max(-1,...initial.filter(x=>x.time<40&&((artist&&key(x.text)===key(artist))||(album&&key(album)!==key(title||'')&&key(x.text)===key(album))||/^(?:作词|作曲|词曲|编曲|演唱|歌手|专辑|LRC|编辑|系列)[：:]/i.test(x.text))).map(x=>(x.time-offset)/scale))
 const seriesAlbum=x=>!!(album&&x.time<40&&key(x.text)===key('传耶稣'+album))
 const foreignTitle=x=>!!(x.time<20&&/^[（(][A-Za-z '\-]+[）)]$/.test(x.text)&&/\p{Script=Han}/u.test(firstBody))
 const titleHeader=x=>!!(title&&key(x.text)===key(title)&&((x.time<10&&firstBody&&!key(firstBody).startsWith(key(title)))||x.time<=boundary+1))
 const lines=parseLrc(withGaps).map(x=>({...x,time:Math.round((x.time-offset)/scale*1000)/1000})).filter(x=>x.time>=0&&x.time<duration&&!/^(?:[a-z0-9-]+\.)+(?:com|net|org|top|cn|cc|ai|uk|icu)(?:\/\S*)?$/i.test(x.text)&&!seriesAlbum(x)&&!foreignTitle(x)&&!/^[©℗]/.test(x.text)&&!/^旷野呼声[-—]/.test(x.text)&&!extraHeader(x)&&!numberedTitle(x)&&!isHeader(x.text)&&!titleHeader(x)&&!/^\s*词\s*[/／、＆&和与]\s*曲\s*[:：]/.test(x.text)&&!/^\s*[—-]*朗诵词.*作者|^\s*lrc|^\s*第\s*\d+\s*首|LRC制作|歌词制作|歌词编辑|https?:\/\/|www\.|^\s*QQ\s*[:：\d]|^\s*(?:歌名|歌曲|编辑|编剧|录音|混音|所属专辑|系列|编号|翻唱自|翻唱|献唱|领唱|原唱|演唱|歌手|音乐人|专辑|作词|作曲|词曲来源|词曲|编曲[/／]唱|编曲|制作人|制作|词|曲)[：:；;]|^《|^【|^词\s+(?:诗|太|约|赛)\s*\d+\s*[:：]/i.test(x.text))
 const instrumental=text=>/^[\s.…·_—()（）【】~*-]*(?:music|instrumental|intro|outro|end|间奏|前奏|尾奏)[\s.…·_—()（）【】~*-]*$/i.test(text)
 const segments=lines.map((x,i)=>({time:x.time,end:lines[i+1]?.time??duration,text:instrumental(x.text)?'':x.text,...(instrumental(x.text)?{kind:'instrumental'}:{})})).filter(x=>x.end>x.time)
 return {syncSegments:segments,lrc:serializeLrc(segments.filter(x=>x.text)),canonical:[...new Set(segments.filter(x=>x.text).map(x=>x.text))],syncCoverage:1,reviewNeeded:false}
}
