import fs from 'node:fs'
import {pinyin} from 'pinyin-pro'
import {parseLrc,serializeLrc} from '../src/lib/lyrics.js'
const root=new URL('../',import.meta.url)
const file=p=>new URL(p,root)
const catalog=JSON.parse(fs.readFileSync(file('static/library/catalog.json')))
const normalize=s=>s.replace(/[^\p{Script=Han}A-Za-z0-9]/gu,'').replaceAll('祢','你').replaceAll('祂','他')
const phonetic=s=>pinyin(s,{toneType:'none',type:'array',nonZh:'consecutive'}).map(x=>x.replace(/^zh/,'z').replace(/^ch/,'c').replace(/^sh/,'s').replace(/ng$/,'n'))
function similarity(a,b){
 if(!a.length||!b.length)return 0
 let prev=Array.from({length:b.length+1},(_,i)=>i)
 for(let i=1;i<=a.length;i++){const row=[i];for(let j=1;j<=b.length;j++)row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=row}
 return 1-prev[b.length]/Math.max(a.length,b.length)
}
const audit={policy:'显示文本仅来自原工程完整歌本；不确定识别片段不作为正式歌词。时间点沿用音频识别，尚需人工试听复核。',songs:[],changes:[],unresolved:[]}
for(const track of catalog){
 const doc=JSON.parse(fs.readFileSync(file(`static/library/${track.id}.json`)))
 const canonical=doc.canonical.map(s=>s.trim()).filter(Boolean)
 // Candidate fragments are contiguous excerpts of songbook lines, including
 // neighboring lines joined by the singer. Never invent a character from ASR.
 const candidates=new Map()
 for(let li=0;li<canonical.length;li++){
   for(let join=1;join<=2&&li+join<=canonical.length;join++){
    const source=canonical.slice(li,li+join).join(' '),chars=[...source],plain=normalize(source)
    // Full lines + clauses. Split fragments only at punctuation/whitespace;
    // arbitrary syllable matching cannot be promoted to publication.
    const fragments=[source,...source.split(/[，。！？；、,!?;\s]+/).filter(Boolean)]
    for(const fragment of fragments){const key=normalize(fragment);if(key.length>=3&&!candidates.has(key))candidates.set(key,{text:fragment,p:phonetic(key),n:[...key],li})}
   }
 }
 const sourceLines=parseLrc(doc.original), output=[]
 let uncertain=0,changed=0,matched=0
 for(const line of sourceLines){
  const n=normalize(line.text),tokens=phonetic(n)
  if(!n)continue
  let best=null
  for(const c of candidates.values()){
   const lengthRatio=Math.min(n.length,c.n.length)/Math.max(n.length,c.n.length)
   if(lengthRatio<0.56)continue
   const literal=similarity([...n],c.n),sound=similarity(tokens,c.p)
   const score=literal*.4+sound*.6
   if(!best||score>best.score)best={...c,score,literal,sound}
  }
  // Approximate alignments go to review. Only near-exact source matches are
  // used as synced text; all other text remains available in full songbook.
  const trusted=best&&(best.literal>=.85 || (best.sound>=.86&&best.literal>=.55)) && best.score>=.74
  if(trusted){
    matched++;output.push({time:line.time,text:best.text})
    if(best.text!==line.text){changed++;audit.changes.push({id:track.id,song:track.title,time:line.time,before:line.text,after:best.text,score:+best.score.toFixed(3)})}
  }else{
    uncertain++;audit.unresolved.push({id:track.id,song:track.title,time:line.time,asr:line.text,suggestion:best?.text,score:best?+best.score.toFixed(3):0})
  }
 }
 const coverage=sourceLines.length?matched/sourceLines.length:0
 doc.recognitionDraft=doc.lrc
 doc.lrc=serializeLrc(output)
 doc.canonical=canonical
 doc.reviewNeeded=uncertain>0
 doc.syncCoverage=coverage
 doc.lyricSource='原工程完整歌本，保留原始识别时间点'
 doc.revision='2026-11-09.1'
 track.reviewNeeded=doc.reviewNeeded;track.syncCoverage=coverage
 fs.writeFileSync(file(`static/library/${track.id}.json`),JSON.stringify(doc))
 audit.songs.push({id:track.id,title:track.title,total:sourceLines.length,matched,changed,unresolved:uncertain,coverage:+coverage.toFixed(3)})
}
fs.writeFileSync(file('static/library/catalog.json'),JSON.stringify(catalog))
fs.writeFileSync(file('docs/lyrics-review.json'),JSON.stringify(audit,null,2))
console.log(JSON.stringify({tracks:catalog.length,sourceOnlyLines:audit.songs.reduce((a,s)=>a+s.matched,0),changes:audit.changes.length,unresolved:audit.unresolved.length,policy:audit.policy},null,2))
