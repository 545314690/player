/** Build reviewable corrections. Publishing requires an explicit --apply after review. */
import fs from 'node:fs'
import {pinyin} from 'pinyin-pro'
import {parseLrc,serializeLrc} from '../src/lib/lyrics.js'
import {fromPublishedLrc} from './lib/published-lyrics.mjs'
import {alignSongbookWords} from './lib/align-songbook-words.mjs'
const base='docs/lyric-audio-review',read=p=>JSON.parse(fs.readFileSync(p)),exists=fs.existsSync
const recordingCorrections=read('scripts/recording-corrections.json'),textCorrections=read('scripts/lyric-text-corrections.json')
const correctedText=text=>textCorrections.reduce((s,c)=>s.replaceAll(c.from,c.to),text).replace(/[\uE000-\uF8FF]/g,' ').replace(/^(?:[（(]\d+[）)]|\d+[.、）)])\s*(?=[\p{Script=Han}A-Za-z])/u,'').replace(/\s*[（(]?[xX×]\s*\d+[）)]?\s*$/,'').replace(/^(?:副歌|合|男|女|李|马)[：:]\s*/,'').replace(/([A-Za-z])[‘’]([A-Za-z])/g,"$1'$2")
const nonLyric=text=>/^[●◆]?\s*(?:(?:作词|作曲|词|曲|编曲|吉他|和声)(?:[、/／](?:作词|作曲|词|曲|编曲|唱|后期|和声))*|演唱者?|主唱|歌手|翻唱自|合唱|歌曲名?|诗歌|歌名|专辑|编辑|翻译|敬拜|微信|LRC|QQ)\s*[:：]/i.test(text)||/^(?:https?:\/\/|www\.|[\w-]+\.(?:uk|cc|com|cn)(?:\/|$))|^【赞美诗歌|^灵爱赞美音乐事工$|^万国敬拜与赞美--$|^华人敬拜赞美(?:音乐)?(?:事工)?$|^凤城华人教会$|^◆.*◆$|^.+【第\d+首】$|^耶稣你是宝贵 - 爱修园$|^儿童诗歌$|^小羊诗歌[－—-]|^荣耀歌 - 圣诞|^[.…\s—―~～]*(?:music|间\s*奏)[.…\s—―~～]*$/i.test(text)
const catalog=read('static/library/catalog.json'),before=read(base+'/pre-full-review-v1.0.6.json'),out=base+'/proposed-corrections';fs.mkdirSync(out,{recursive:true})
const normalize=s=>s.replaceAll('祂','他').replaceAll('祢','你').replace(/[^\p{Script=Han}A-Za-z0-9\p{Script=Hangul}]/gu,'').toLowerCase()
function cleanBook(lines){return lines.flatMap(x=>x.includes('领受主的1慈爱2喜乐3恩膏')?['hey ho 领受主的慈爱','hey ho 领受主的喜乐','hey ho 领受主的恩膏']:[x]).map(correctedText).filter(x=>x.trim()&&!nonLyric(x))}
function bookFromSource(source){
 const published=fromPublishedLrc(source.lrc||'',Infinity,0,1,source);if(published.canonical.length>=4)return cleanBook(published.canonical)
 return (source.plain||'').split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!/^(歌名|专辑|音乐人|词曲|系列|编号|作词|作曲|编曲|演唱|歌词制作|歌词编辑|LRC|QQ|点击听歌|https?:)/.test(s)&&!s.includes('☞'))
}
const report={recordings:[],policy:'Whole-library checks distinguish a matching published recording from acoustic alignment. Raw recognition is never lyric copy; uncertain results are not labelled exact.'}
for(const t of catalog){
 const original=before[t.id],d=structuredClone(original),reviewPath=`${base}/full-audio/${t.id}.json`,matchPath=`${base}/recording-matches/${t.id}.json`,proof=exists(matchPath)?read(matchPath).match:null,review=exists(reviewPath)?read(reviewPath):null
 let method='awaiting-full-review',formalSource=null,newDoc=null,alignment=null,book=d.canonical,correctedTitle=t.title,correctedVariant=t.variant
 if(proof){
  const source=read(`${base}/sources/${proof.source}.json`),title=source.plain?.match(/^歌名[：:](.+)/m)?.[1]?.trim();if(title)correctedTitle=title.replace(/^(?:第\s*\d+\s*首|\d{3,4})\s*[.、]?\s*/,'');if(correctedTitle==='主你若究查罪孽')correctedTitle='主你若究察罪孽'
  if(parseLrc(source.lrc||'').length>=4){newDoc=fromPublishedLrc(source.lrc,d.audioDuration,proof.offset,proof.scale||1,source);if(newDoc.canonical.length>=3){method='recording-matched-published-lyric';formalSource=source.url;Object.assign(d,newDoc);d.timingSource={url:source.url,basis:'full recording cross-correlation and eight waveform windows',offset:proof.offset,scale:proof.scale,proof:`recording-matches/${t.id}.json`}}else newDoc=null}
 }
 const correction=recordingCorrections[t.id];if(correction?.type==='instrumental'){Object.assign(d,{instrumental:true,canonical:[],lrc:'',syncSegments:[{time:0,end:d.audioDuration,text:'',kind:'pure-instrumental'}],syncCoverage:1,reviewNeeded:false,revision:'2026-11-10.1',timingRevision:'full-library-review-v4',timingSource:{url:correction.source,basis:correction.basis},lyricSource:'对应正式器乐录音，无人声歌词'});delete d.syncIssue;correctedTitle=correction.title||correctedTitle;correctedVariant=correction.variant||correctedVariant}
 if(d.instrumental){method='verified-instrumental';newDoc=null}
 else if(!newDoc&&original.reviewNeeded===false){method='verified-embedded-recording-lyric';newDoc=structuredClone(original)}
 else if(!newDoc&&review&&!review.method){
  const options=[{book:cleanBook(d.canonical),source:'existing songbook'}];const foreignPath=`${base}/foreign-books/${t.id}.json`;if(exists(foreignPath)){const f=read(foreignPath);if(f.forceSongbook)options.length=0;options.push({book:f.canonical,source:f.source,forceSongbook:f.forceSongbook})}const candidatePath=`${base}/source-candidates/${t.id}.json`
  if(!options.some(x=>x.forceSongbook)&&exists(candidatePath))for(const c of read(candidatePath).candidates||[]){const p=`${base}/sources/${c.id}.json`;if(exists(p)){const source=read(p),book=bookFromSource(source);if(book.length>=3)options.push({book,source:source.url})}}
  for(const option of options){const result=alignSongbookWords(review,cleanBook(option.book),d.audioDuration);if(!option.forceSongbook&&option.source!=='existing songbook'&&(result.matchedCharacters<24||result.matchedCharacters/Math.max(1,result.observedCharacters)<.12))continue;if(!alignment||result.matchedCharacters>alignment.matchedCharacters*1.04){alignment=result;book=option.book;formalSource=option.source}}
  book=cleanBook(book)
  if(alignment?.segments.length){
   const fresh=alignment.segments,previous=(original.syncSegments||parseLrc(original.lrc)).filter(x=>x.text&&x.time<d.audioDuration),segments=[...fresh]
   // Preserve prior canonical fragments only outside newly observed vocal
   // phrases. Never fill a silence by spreading words over song duration.
   for(const old of previous){if(!book.some(x=>normalize(x).includes(normalize(old.text))))continue;const end=Math.min(old.end??old.time+8,d.audioDuration);if(end<=old.time)continue
    const conflicts=fresh.filter(x=>x.time<end&&x.end>old.time)
    if(conflicts.length)continue
    let display=old.text;for(const line of book){const chars=[...line],keys=chars.map(normalize),key=keys.join(''),needle=normalize(old.text),at=key.indexOf(needle);if(at<0)continue;let n=0,start=-1,stop=-1;for(let j=0;j<chars.length;j++){if(n===at&&start<0&&keys[j])start=j;n+=keys[j].length;if(n===at+needle.length){stop=j+1;break}}if(start>=0&&stop>start)display=chars.slice(start,stop).join('');break}
    segments.push({...old,text:display,end,basis:'retained-prior-songbook-fragment',reviewNeeded:true})
   }
   segments.sort((a,b)=>a.time-b.time);for(let i=0;i<segments.length;i++){const x=segments[i];x.end=Math.min(x.end,segments[i+1]?.time??d.audioDuration);x.time=+x.time.toFixed(3);x.end=+x.end.toFixed(3)}
   d.syncSegments=segments.filter(x=>x.end>x.time);d.lrc=serializeLrc(d.syncSegments);d.canonical=[...new Set(book)];d.reviewNeeded=true;d.syncCoverage=alignment.observedCharacters?Math.min(1,alignment.matchedCharacters/alignment.observedCharacters):0;d.timingSource={url:formalSource,basis:'complete-audio DTW word alignment; prior fragments explicitly retained',proof:`full-audio/${t.id}.json`};method='full-audio-aligned-songbook'
  }else method='full-audio-no-reliable-alignment'
 }
 if(method==='recording-matched-published-lyric'||method==='full-audio-aligned-songbook'){
  d.revision='2026-11-10.1';d.timingRevision='full-library-review-v4';d.lyricSource=method==='recording-matched-published-lyric'?'对应录音的正式歌词，已测量剪辑偏移与速度差':'完整录音逐词定位并对照歌本，未确认片段仍需复核';delete d.syncIssue
 }
 for(const change of correction?.segmentReplacements||[]){const line=d.syncSegments?.find(x=>Math.abs(x.time-change.time)<.02&&x.text===change.from);if(line)line.text=change.to}
 d.canonical=cleanBook(d.canonical);if(d.syncSegments){d.syncSegments=d.syncSegments.map(x=>nonLyric(x.text)?{...x,text:'',kind:'instrumental'}:{...x,text:correctedText(x.text)});d.lrc=serializeLrc(d.syncSegments.filter(x=>x.text))}
 const oldLines=(original.syncSegments||[]).filter(x=>x.text),newLines=(d.syncSegments||[]).filter(x=>x.text),changed=JSON.stringify(d.syncSegments)!==JSON.stringify(original.syncSegments)||JSON.stringify(d.canonical)!==JSON.stringify(original.canonical)
 report.recordings.push({id:t.id,file:t.file,method,fullReview:!!review,correctedTitle,correctedVariant,formalSource,waveformMatched:!!proof,changed,oldFragments:oldLines.length,newFragments:newLines.length,oldCharacters:oldLines.reduce((n,x)=>n+normalize(x.text).length,0),newCharacters:newLines.reduce((n,x)=>n+normalize(x.text).length,0),alignment:alignment?{observedCharacters:alignment.observedCharacters,matchedCharacters:alignment.matchedCharacters}:null,reviewNeeded:d.reviewNeeded})
 fs.writeFileSync(`${out}/${t.id}.json`,JSON.stringify(d))
}
report.summary={total:catalog.length,fullReviewed:report.recordings.filter(x=>x.fullReview).length,waveformMatched:report.recordings.filter(x=>x.waveformMatched).length,changed:report.recordings.filter(x=>x.changed).length,methods:Object.fromEntries([...new Set(report.recordings.map(x=>x.method))].map(method=>[method,report.recordings.filter(x=>x.method===method).length]))}
fs.writeFileSync(`${base}/full-library-report.json`,JSON.stringify(report,null,2));console.log(report.summary)
if(process.argv.includes('--apply')){if(report.summary.fullReviewed!==catalog.length)throw Error('All recordings require a review record before publishing');for(const t of catalog){const d=read(`${out}/${t.id}.json`);fs.writeFileSync(`static/library/${t.id}.json`,JSON.stringify(d));const entry=report.recordings.find(x=>x.id===t.id);t.title=entry.correctedTitle;t.letter=pinyin(t.title[0]||'',{pattern:'first',toneType:'none'}).toUpperCase().replace(/[^A-Z]/g,'').slice(0,1)||'#';t.variant=entry.correctedVariant;t.texts=d.canonical;t.syncCoverage=d.syncCoverage;t.reviewNeeded=d.reviewNeeded}fs.writeFileSync('static/library/catalog.json',JSON.stringify(catalog))}
