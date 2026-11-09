import {pinyin} from 'pinyin-pro'
import {parseLrc} from '../../src/lib/lyrics.js'
const sounds=new Map()
const normal=c=>c.replaceAll('祢','你').replaceAll('祂','他')
const sound=c=>{if(!sounds.has(c))sounds.set(c,pinyin(normal(c),{toneType:'none'}));return sounds.get(c)}
const chars=s=>[...s].filter(c=>/[\p{Script=Han}A-Za-z0-9]/u.test(c))
// Align all of an observed phrase to a contiguous songbook excerpt. This
// restores split/combined clauses without manufacturing words or timestamps.
export function matchExcerpt(observed,canonical){
 const raw=canonical.join(' '),target=[],positions=[];[...raw].forEach((c,i)=>{if(/[\p{Script=Han}A-Za-z0-9]/u.test(c)){target.push(c);positions.push(i)}})
 const source=chars(observed),n=source.length,m=target.length
 if(n<3||!m||n>100)return null
 const rows=[new Float32Array(m+1)],paths=[new Uint8Array(m+1)]
 for(let i=1;i<=n;i++){
  const row=new Float32Array(m+1),path=new Uint8Array(m+1);row[0]=i
  for(let j=1;j<=m;j++){
   const cost=normal(source[i-1])===normal(target[j-1])?0:sound(source[i-1])===sound(target[j-1])?.2:1
   const options=[rows[i-1][j-1]+cost,rows[i-1][j]+1,row[j-1]+1];let k=0;if(options[1]<options[k])k=1;if(options[2]<options[k])k=2;row[j]=options[k];path[j]=k
  }rows.push(row);paths.push(path)
 }
 const candidates=[]
 for(let end=1;end<=m;end++){
  let i=n,j=end,literal=0,phonetic=0
  while(i>0&&j>0){const step=paths[i][j];if(step===0){if(normal(source[i-1])===normal(target[j-1]))literal++;if(sound(source[i-1])===sound(target[j-1]))phonetic++;i--;j--}else if(step===1)i--;else j--}
  const length=end-j,ratio=Math.min(length,n)/Math.max(length,n),confidence=1-rows[n][end]/Math.max(n,length)
  if(i||ratio<.72||length<3)continue
  const text=[...raw].slice(positions[j],positions[end-1]+1).join(''),boundary=(j===0||positions[j]-positions[j-1]>1)&&(end===m||positions[end]-positions[end-1]>1)
  candidates.push({text,start:j,end,confidence,literal:literal/Math.max(n,length),phonetic:phonetic/Math.max(n,length),rank:confidence+(boundary?.025:0)})
 }
 candidates.sort((a,b)=>b.rank-a.rank)
 const best=candidates[0];if(!best)return null
 const other=candidates.find(c=>normal(c.text.replace(/\s/g,''))!==normal(best.text.replace(/\s/g,'')))
 const margin=other?best.rank-other.rank:1
 const trusted=(best.confidence>=.84&&best.literal>=.5&&best.phonetic>=.78&&(n>=4||best.literal===1))||(best.literal>=.9&&n>=4)
 return {...best,trusted:trusted&&(margin>=.035||best.literal>=.95),margin}
}
export function alignFragments(original,canonical,duration=Infinity){
 const source=Array.isArray(original)?original:parseLrc(original),segments=[]
 for(let i=0;i<source.length;i++){
  const line=source[i];if(line.time>=duration)continue
  let match=matchExcerpt(line.text,canonical),last=i
  // Tiny split syllables need an adjacent observed phrase, never guessed timing.
  if(chars(line.text).length<3&&i+1<source.length&&source[i+1].time-line.time<4){const joined=matchExcerpt(line.text+source[i+1].text,canonical);if(joined?.trusted){match=joined;last=++i}}
  const next=source[last+1]?.time,end=Number.isFinite(source[last].end)?Math.min(source[last].end,next??Infinity,duration):Number.isFinite(next)?Math.min(next,duration):Number.isFinite(duration)?duration:undefined
  segments.push({time:line.time,...(end!==undefined?{end}:{}),text:match?.trusted?match.text:'',confidence:+(match?.confidence||0).toFixed(3),observed:line.text,match})
 }
 // Context may restore a short corruption only when both independently
 // trusted neighbors meet this exact excerpt, not merely a similar phrase.
 for(let i=1;i<segments.length-1;i++){
  const a=segments[i-1],b=segments[i],c=segments[i+1],m=b.match
  if(!b.text&&a.text&&c.text&&m&&m.confidence>=.67&&m.phonetic>=.65&&m.literal>=.4&&a.match.end===m.start&&m.end===c.match.start){b.text=m.text;b.basis='two-sided-context'}
 }
 return segments.map(({match,...line})=>line)
}
