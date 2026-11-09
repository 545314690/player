import fs from 'node:fs'
import assert from 'node:assert/strict'
const read=p=>JSON.parse(fs.readFileSync(p)),base='docs/lyric-audio-review',catalog=read('static/library/catalog.json'),report=read(base+'/full-library-report.json')
assert.equal(report.summary.fullReviewed,catalog.length)
let segments=0,uncertain=0
for(const t of catalog){
 const d=read(`${base}/proposed-corrections/${t.id}.json`),review=read(`${base}/full-audio/${t.id}.json`)
 assert.ok(review.recordingHash,`${t.file}: recording identity missing`)
 assert.ok(d.audioDuration>0)
 let last=-1
 for(const x of d.syncSegments||[]){
  assert.ok(Number.isFinite(x.time)&&Number.isFinite(x.end)&&x.time>=0&&x.end>x.time&&x.end<=d.audioDuration+.05,`${t.file}: invalid bounds ${JSON.stringify(x)}`)
  assert.ok(x.time>=last,`${t.file}: unsorted cues`);last=x.time
  assert.ok(!/[\uE000-\uF8FF\uFFFD]/.test(x.text),`${t.file}: invalid display character`)
  assert.ok(!/^(?:LRC|QQ|微信|作词|作曲|编曲|歌曲名|歌名|编辑)\s*[:：]|https?:\/\//i.test(x.text),`${t.file}: credit displayed`)
  if(x.text)segments++
 }
 if(d.instrumental)assert.equal((d.syncSegments||[]).filter(x=>x.text).length,0)
 if(d.reviewNeeded)uncertain++
}
console.log(JSON.stringify({recordings:catalog.length,timedVocalCues:segments,stillNeedsTimingReview:uncertain}))
