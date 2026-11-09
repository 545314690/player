import fs from 'node:fs'
import {alignFragments} from './lib/align-lyrics.mjs'
import {parseLrc,serializeLrc} from '../src/lib/lyrics.js'
import {fromPublishedLrc} from './lib/published-lyrics.mjs'
const read=p=>JSON.parse(fs.readFileSync(p)),catalog=read('static/library/catalog.json'),inventory=read('docs/lyric-audio-review/inventory.json'),inv=new Map(inventory.map(x=>[x.id,x]))
const docs=new Map(catalog.map(t=>[t.id,read(`static/library/${t.id}.json`)]))
const baseline=read('docs/lyric-audio-review/baseline.json')
const metadata=read('docs/lyric-audio-review/metadata.json'),officials=['17413','1298'].map(id=>({...read(`docs/lyric-audio-review/official/${id}.json`),id}))
const overrides=read('scripts/lyric-overrides.json'),report={songs:[],policy:'文字来自该录音对应歌本；不可靠片段保留缺口；不把近似对齐当作人工听校。'}
for(const t of catalog){
 const d=docs.get(t.id),audio=inv.get(t.id),o=overrides[t.id]||{},donor=o.donor?docs.get(o.donor):null
 if(donor){if(!audio.fullPcmSha256||audio.fullPcmSha256!==inv.get(o.donor).fullPcmSha256)throw Error('Unproven audio donor '+t.id);d.canonical=donor.canonical;d.timingOriginal=donor.original;d.timingRevision='audio-v2';d.timingSource={id:o.donor,basis:'identical decoded full PCM SHA256'};t.texts=d.canonical}
 d.canonical=d.canonical.map(x=>x.replace(/\\u([0-9a-fA-F]{4})/g,(_,hex)=>String.fromCharCode(parseInt(hex,16))).replace(/\\[nrt]/g,' ').replace(/[\uE000-\uF8FF]/g,'').trim());t.texts=d.canonical
 const original=d.timingOriginal||d.original
 let refreshed=`docs/lyric-audio-review/${t.id}.json`
 if(!fs.existsSync(refreshed)&&t.id==='sb826f339f00a')refreshed='docs/lyric-audio-review/s7d549dc98ab9.json'
 const actual=fs.existsSync(refreshed)?read(refreshed):null
 const invalidTimeline=o.forceRefresh||!parseLrc(original).length||parseLrc(original).some(x=>x.time>audio.duration+3)
 const old=new Map(parseLrc(baseline[o.donor||t.id]||'').map(x=>[x.time,x.text]))
 let segments=alignFragments(invalidTimeline&&actual?actual.lines:original,d.canonical,audio.duration)
 if(!invalidTimeline)for(const line of segments)if(!line.text&&old.has(line.time))line.text=old.get(line.time)
 if(invalidTimeline&&!actual){segments=segments.map(x=>({...x,text:''}));d.syncIssue='当前录音的时间轴尚未匹配';}else delete d.syncIssue
 const fixedAt=new Map(Object.entries(o.at||{}).map(([time,text])=>[Math.round(Number(time)*100),text]))
 for(const line of segments){const text=fixedAt.get(Math.round(line.time*100));if(text){line.text=text;line.basis='version-specific-songbook-sequence'}}
 if(actual){
  const fresh=alignFragments(actual.lines,d.canonical,audio.duration)
  if(!invalidTimeline){
   const used=new Set()
   for(const line of segments){
    const candidates=fresh.filter((x,i)=>x.text&&!used.has(i)&&Math.abs(x.time-line.time)<2&&(line.text?x.text.replace(/\s/g,'')===line.text.replace(/\s/g,''):x.confidence>=.9))
    candidates.sort((a,b)=>Math.abs(a.time-line.time)-Math.abs(b.time-line.time))
    const found=candidates[0];if(found){used.add(fresh.indexOf(found));line.time=found.time;line.end=found.end;if(!line.text)line.text=found.text;line.basis='audio-word-boundaries'}
   }
  }
  d.timingRevision='audio-v2';d.timingSource={...(d.timingSource||{}),refinement:'local audio recognition with word boundaries',model:actual.model}
 }
 segments.sort((a,b)=>a.time-b.time)
 // A long unobserved interval must not keep the preceding phrase active for
 // a minute. Clear the highlight conservatively without moving its start.
 for(let i=0;i<segments.length;i++){const line=segments[i],next=segments[i+1]?.time;if(next!==undefined&&line.end>next)line.end=next;if(line.text&&line.end-line.time>25){line.end=line.time+Math.min(20,Math.max(8,line.text.replace(/\s/g,'').length));line.endEstimated=true}}
 if(!segments.some(x=>x.text))d.syncIssue='当前录音暂无可靠同步歌词'
 for(const line of segments)if(Number.isFinite(line.end)&&line.end<=line.time)line.text=''
 delete d.audioRecognition
 d.syncSegments=segments.map(({observed,...x})=>x)
 d.lrc=serializeLrc(segments.filter(x=>x.text));d.syncCoverage=segments.length?segments.filter(x=>x.text).length/segments.length:0;d.audioDuration=audio.duration;d.audioFingerprint=audio.pcmSignature;d.reviewNeeded=true;d.revision='2026-11-09.3';d.lyricSource='按录音版本核对歌本，片段边界同步；未确认处不强行匹配'
 let published=null,source=null;const official=officials.find(x=>x.tracks.includes(t.id))
 if(official){published=fromPublishedLrc(fs.readFileSync(`docs/lyric-audio-review/official/${official.id}.lrc`,'utf8'),audio.duration,official.offset);source={url:official.source,basis:'matching recording confirmed by four waveform windows',offset:official.offset}}
 else {const meta=metadata.find(x=>x.id===t.id),path=`docs/lyric-audio-review/provider/${meta?.providerId}.json`;if(meta?.providerId&&fs.existsSync(path)&&Math.abs(meta.providerDuration/1000-audio.duration)<1.5){const raw=read(path).lrc?.lyric;if(raw&&!/暂无歌词|纯音乐|无歌词/.test(raw)&&parseLrc(raw).length>5){published=fromPublishedLrc(raw,audio.duration);source={url:'https://music.163.com/song?id='+meta.providerId,basis:'original recording ID embedded in audio metadata; matching duration'}}}}
 if(published){Object.assign(d,published);d.timingSource=source;d.timingRevision='recording-matched-v3';delete d.syncIssue;delete d.endEstimated;segments=d.syncSegments;t.texts=d.canonical}
 if(t.id==='s7ea528419084'){Object.assign(d,{canonical:[],lrc:'',syncSegments:[{time:0,end:audio.duration,text:'',kind:'pure-instrumental'}],reviewNeeded:false,syncCoverage:1,timingRevision:'instrumental-v3',lyricSource:'Dongye《Walking with HIM》钢琴纯音乐',timingSource:{url:'https://www.izanmei.com/album/walking-with-him.html',basis:'embedded artist, album and original recording ID; published instrumental album'},instrumental:true});delete d.syncIssue;segments=d.syncSegments;t.texts=[]}else delete d.instrumental;
 t.syncCoverage=d.syncCoverage;t.reviewNeeded=d.reviewNeeded;t.audioDuration=audio.duration
 report.songs.push({id:t.id,file:t.file,matched:segments.filter(x=>x.text).length,total:segments.length,coverage:d.syncCoverage,issue:d.syncIssue||null,source:d.timingSource||null})
 fs.writeFileSync(`static/library/${t.id}.json`,JSON.stringify(d))
}
fs.writeFileSync('static/library/catalog.json',JSON.stringify(catalog));fs.writeFileSync('docs/lyric-audio-review/alignment.json',JSON.stringify(report,null,2));console.log({matched:report.songs.reduce((n,s)=>n+s.matched,0),total:report.songs.reduce((n,s)=>n+s.total,0),disabled:report.songs.filter(s=>s.issue).length})
