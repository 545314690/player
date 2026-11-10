import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {alignSongbookWords} from '../scripts/lib/align-songbook-words.mjs'
const phrase=(text,time)=>[...text].map((text,i)=>({text,time:time+i*.45,end:time+i*.45+.3,probability:1}))
const review=words=>({lines:words.map(w=>({text:w.text,time:w.time,end:w.end,words:[w]}))})
test('Complete clauses recover across arbitrary ASR fragment boundaries using observed word times',()=>{
 const result=alignSongbookWords(review(phrase('爱是恒久忍耐又有恩慈',12)),['爱是恒久忍耐又有恩慈'],100)
 assert.equal(result.segments.length,1);assert.equal(result.segments[0].time,12);assert.equal(result.segments[0].text,'爱是恒久忍耐又有恩慈')
})
test('A repeated verse gets separate acoustic occurrences without borrowing absent book lines',()=>{
 const result=alignSongbookWords(review([...phrase('你们要赞美耶和华',10),...phrase('你们要赞美耶和华',60)]),['你们要赞美耶和华','这句并没有唱出来'],100)
 assert.deepEqual(result.segments.map(x=>x.time),[10,60]);assert.ok(result.segments.every(x=>x.text==='你们要赞美耶和华'))
})
test('Wrong-song references and long unobserved gaps cannot manufacture a complete lyric',()=>{
 assert.equal(alignSongbookWords(review(phrase('完全不同的内容',10)),['你们要赞美耶和华'],100).segments.length,0)
 const words=[...phrase('你们要',10),...phrase('赞美耶和华',40)]
 assert.equal(alignSongbookWords(review(words),['你们要赞美耶和华'],100).segments.length,0)
})
test('Formal LRC retains timed empty interludes and compensates measured recording speed',async()=>{
 const {fromPublishedLrc}=await import('../scripts/lib/published-lyrics.mjs')
 const d=fromPublishedLrc('[00:00]词曲：作者\n[00:11]第一句\n[00:22]\n[00:33]下一句',50,0,1.1)
 assert.deepEqual(d.syncSegments.map(x=>x.time),[10,20,30]);assert.equal(d.syncSegments[0].end,20);assert.equal(d.syncSegments[1].kind,'instrumental');assert.equal(d.syncSegments[1].text,'')
 assert.equal(fromPublishedLrc('[00:01]I love music',10).canonical[0],'I love music')
})
test('English sentences keep words together and short amens require exact acoustic evidence',()=>{
 const words=[{text:'Amazing ',time:10,end:11,probability:.95},{text:'grace ',time:12,end:13,probability:.95},{text:'how sweet ',time:14,end:16,probability:.95},{text:'the sound',time:17,end:19,probability:.95}]
 const d=alignSongbookWords(review(words),['Amazing grace how sweet the sound'],30)
 assert.deepEqual(d.segments.map(x=>x.text),['Amazing grace how sweet the sound'])
 assert.equal(alignSongbookWords(review(phrase('阿们',20)),['阿们'],30).segments.length,1)
 const weak=phrase('阿们',20).map(x=>({...x,probability:.2}));assert.equal(alignSongbookWords(review(weak),['阿们'],30).segments.length,0)
})
test('Published lyric credits and parenthesized music cues never become sung lyrics',async()=>{
 const {fromPublishedLrc}=await import('../scripts/lib/published-lyrics.mjs')
 const d=fromPublishedLrc('[00:00]歌词制作：制作人\n[00:01]QQ:123456\n[00:03](Music)\n[00:10]实际唱出的歌词',30)
 assert.deepEqual(d.canonical,['实际唱出的歌词']);assert.equal(d.syncSegments[0].kind,'instrumental')
})
test('Song-artist headers and combined composer credits are stripped using source metadata',async()=>{
 const {fromPublishedLrc}=await import('../scripts/lib/published-lyrics.mjs');const doc=fromPublishedLrc('[00:00]阿爸父 - 我心旋律\n[00:01]词、曲：作者\n[00:02]词/曲：作者\n[00:10]阿爸父 哦阿爸父',30,0,1,{plain:'歌名：阿爸父\n音乐人：我心旋律'})
 assert.deepEqual(doc.canonical,['阿爸父 哦阿爸父'])
})
test('Late prelude credits do not hide the real first sung title line',async()=>{
 const {fromPublishedLrc}=await import('../scripts/lib/published-lyrics.mjs')
 const d=fromPublishedLrc('[00:17.18]耶稣我爱你\n[00:18.77]万国敬拜与赞美\n[00:19.39]传耶稣耶稣我爱你\n[00:20.75]\n[00:23.72]耶稣我爱你\n[00:27]俯伏在你面前',50,0,1,{plain:'歌名：耶稣我爱你\n专辑：耶稣我爱你\n音乐人：万国敬拜与赞美\n\n耶稣我爱你\n俯伏在你面前'})
 assert.deepEqual(d.canonical,['耶稣我爱你','俯伏在你面前']);assert.equal(d.syncSegments.find(x=>x.text)?.time,23.72)
})
test('Duplicate empty timestamps cannot generate zero-length scrolling cues',async()=>{
 const {fromPublishedLrc}=await import('../scripts/lib/published-lyrics.mjs')
 const d=fromPublishedLrc('[00:00.40]\n[00:00.40]\n[00:10]歌声',30)
 assert.ok(d.syncSegments.every(x=>x.end>x.time))
})
test('Korean lyric track keeps an independent language timeline',()=>{
 const d=JSON.parse(fs.readFileSync('static/library/s5ee01e3832a5.json'))
 assert.deepEqual(d.lyricLanguages,['zh','ko']);assert.equal(d.syncSegmentsKo.length,d.syncSegments.length)
 assert.deepEqual(d.syncSegmentsKo.map(x=>[x.time,x.end]),d.syncSegments.map(x=>[x.time,x.end]))
})
