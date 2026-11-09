import {pinyin} from 'pinyin-pro'
const norm=s=>s.replaceAll('祢','你').replaceAll('祂','他')
const clean=s=>[...norm(s)].filter(c=>/[\p{Script=Han}A-Za-z0-9\p{Script=Hangul}]/u.test(c))
const soundCache=new Map(),sound=c=>{if(!soundCache.has(c))soundCache.set(c,/\p{Script=Han}/u.test(c)?pinyin(c,{toneType:'none'}):c.toLowerCase());return soundCache.get(c)}
export function alignSongbookWords(review,canonical,duration=Infinity){
 const observed=[]
 for(const line of review.lines||[]){
  // Long repeated hallucinations at one instant are not evidence of singing.
  if(line.text.length>45&&(line.end-line.time)/line.text.length<.075)continue
  const words=line.words?.length?line.words:[{text:line.text,time:line.time,end:line.end,probability:1}]
  for(const word of words){if(word.time<0||word.time>=duration||word.end<word.time)continue;for(const c of clean(word.text)){const previous=observed.at(-1);if(previous&&word.time<previous.time-.2)continue;observed.push({c,time:word.time,end:Math.min(word.end,duration),p:word.probability??1})}}
 }
 const phrases=[...new Set(canonical.flatMap(x=>x.split(/\p{Script=Han}/u.test(x)?/[\s，。！？；、…,.!?;]+/u:/[，。！？；、…,.!?;]+/u)).map(x=>x.trim()).filter(x=>clean(x).length>=2&&clean(x).length<=40))],candidates=[]
 for(const text of phrases){
  const target=clean(text),m=target.length,n=observed.length,rows=[new Float32Array(n+1)],paths=[new Uint8Array(n+1)]
  for(let i=1;i<=m;i++){
   const row=new Float32Array(n+1),path=new Uint8Array(n+1);row[0]=i*1.1
   for(let j=1;j<=n;j++){
    const a=target[i-1],b=observed[j-1].c,cost=a===b?0:sound(a)===sound(b)?.18:1
    const values=[rows[i-1][j-1]+cost,rows[i-1][j]+1.1,row[j-1]+1.1];let k=0;if(values[1]<values[k])k=1;if(values[2]<values[k])k=2;row[j]=values[k];path[j]=k
   }rows.push(row);paths.push(path)
  }
  for(let end=1;end<=n;end++){
   const confidence=1-rows[m][end]/m;if(confidence<.64)continue
   let i=m,j=end,literal=0,phonetic=0,paired=0;const mapped=[]
   while(i>0&&j>0){const step=paths[i][j];if(step===0){paired++;if(target[i-1]===observed[j-1].c)literal++;if(sound(target[i-1])===sound(observed[j-1].c))phonetic++;mapped.push(j-1);i--;j--}else if(step===1)i--;else j--}
   if(i||paired/m<.8||phonetic/m<.72||literal/m<.4||end-j>m*1.4)continue
   if(m<4&&(literal!==m||mapped.some(index=>observed[index].p<.7)))continue
   mapped.reverse();const first=observed[mapped[0]],last=observed[mapped.at(-1)];if(last.end-first.time>Math.max(10,m*1.5)||last.end-first.time<.35)continue
   if(mapped.some((v,k)=>k&&observed[v].time-observed[mapped[k-1]].end>2.5))continue
   candidates.push({start:j,stop:end,time:first.time,end:last.end,text,confidence:+confidence.toFixed(4),score:paired*confidence*confidence,basis:'full-audio-word-alignment'})
  }
 }
 candidates.sort((a,b)=>a.stop-b.stop||a.start-b.start||b.score-a.score)
 // Weighted interval selection keeps repeated verses and prevents conflicting
 // songbook clauses from borrowing the same observed words.
 const scores=[0],takes=[],previous=[]
 for(let i=0;i<candidates.length;i++){
  const c=candidates[i];let lo=0,hi=i-1,p=-1;while(lo<=hi){const mid=(lo+hi)>>>1;if(candidates[mid].stop<=c.start){p=mid;lo=mid+1}else hi=mid-1}
  const include=scores[p+1]+c.score,exclude=scores[i];takes[i]=include>exclude;previous[i]=p;scores[i+1]=Math.max(include,exclude)
 }
 const selected=[];for(let i=candidates.length-1;i>=0;){if(takes[i]){selected.push(candidates[i]);i=previous[i]}else i--}selected.reverse()
 return {segments:selected.map(({start,stop,score,...x},i)=>({...x,end:Math.min(selected[i+1]?.time??duration,x.end+.45),endEstimated:true})),observedCharacters:observed.length,matchedCharacters:selected.reduce((n,x)=>n+x.stop-x.start,0)}
}
