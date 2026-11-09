import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {alignFragments} from '../scripts/lib/align-lyrics.mjs'
import {activeLine,resolveLyricLines} from '../src/lib/lyrics.js'
test('Split songbook clauses and repeated verses keep their own observed timestamps',()=>{
 const book=['爱是恒久忍耐又有恩慈','爱是不嫉妒']
 const lines=alignFragments('[00:12.36]爱是恒久忍耐\n[00:14.70]拥有恩赐\n[00:17]爱是不嫉妒\n[01:17.96]爱是恒久忍耐',book,140)
 assert.equal(lines[0].text,'爱是恒久忍耐');assert.equal(lines[1].text,'又有恩慈');assert.equal(lines[1].time,14.7);assert.equal(lines[3].time,77.96)
})
test('Uncertain gaps stop stale highlighting and honor positive and negative offsets',()=>{
 const d={syncSegments:[{time:10,end:15,text:'第一句'},{time:15,end:20,text:''},{time:20,end:25,text:'下一句'}]};const l=resolveLyricLines(d)
 assert.equal(activeLine(l,14),0);assert.equal(activeLine(l,15),-1);assert.equal(activeLine(l,19),-1);assert.equal(activeLine(l,20),1);assert.equal(activeLine(l,25),-1);assert.equal(activeLine(l,16,2),0);assert.equal(activeLine(l,13,-2),-1)
 assert.equal(resolveLyricLines(d,'[00:01]本机修改')[0].text,'本机修改')
})
test('Audio-derived end boundaries survive alignment and recognition errors stay unpublished',()=>{
 const l=alignFragments([{time:3,end:5,text:'你们要赞美耶和华'},{time:8,end:10,text:'广告完全无关内容'}],['你们要赞美耶和华'],20)
 assert.equal(l[0].end,5);assert.equal(l[1].text,'');assert.equal(activeLine(l.filter(x=>x.text),7),-1)
})
test('The cheerful variant uses the identical recording and correct songbook, not the short namesake',()=>{
 const inv=JSON.parse(fs.readFileSync('docs/lyric-audio-review/inventory.json')),a=inv.find(x=>x.id==='s7d549dc98ab9'),b=inv.find(x=>x.id==='sb826f339f00a');assert.equal(a.fullPcmSha256,b.fullPcmSha256);assert.ok(a.duration>200)
 const d=JSON.parse(fs.readFileSync('static/library/s7d549dc98ab9.json'));assert.ok(d.canonical.some(x=>x.replaceAll('祂','他')==='在高处赞美他'));assert.ok(!d.canonical.includes('在他的圣所赞美他'));assert.ok(resolveLyricLines(d).every(x=>x.time<a.duration))
})

test('A cached older remote revision cannot roll back repaired APK lyrics',async()=>{
 const {selectLyricDocument}=await import('../src/lib/lyric-document.js');const bundled={revision:'2026-11-09.2',lrc:'new'}
 assert.equal(selectLyricDocument(bundled,{revision:'2026-11-09.1',lrc:'old'}),bundled)
 assert.equal(selectLyricDocument(bundled,{revision:'2026-11-09.10',lrc:'later'}).lrc,'later')
 assert.equal(selectLyricDocument(bundled,{revision:'2026-11-09.3'}),bundled)
})

test('Published exact-recording lyrics preserve repeated tags, spoken parts and measured intro trim',async()=>{
 const {fromPublishedLrc}=await import('../scripts/lib/published-lyrics.mjs');const doc=fromPublishedLrc('[00:10.00][00:20.00]重复歌词\n[00:15.00]口白内容\n[00:30.00]Music',30,5)
 assert.deepEqual(doc.syncSegments.map(x=>x.time),[5,10,15,25]);assert.equal(doc.syncSegments[1].text,'口白内容');assert.equal(doc.syncSegments[3].text,'');assert.equal(doc.syncSegments[0].end,10)
 const proof=JSON.parse(fs.readFileSync('docs/lyric-audio-review/official/17413.json'));assert.ok(proof.correlation.every(x=>x.coefficient>.9&&x.offset===34.1755))
 const d=JSON.parse(fs.readFileSync('static/library/s7d549dc98ab9.json'));assert.equal(d.reviewNeeded,false);assert.ok(d.syncSegments.some(x=>x.text.includes('高举双手')));assert.ok(d.syncSegments.some(x=>x.text.includes('因歌颂我们的神')))
})

test('Instrumental recording never borrows a vocal lyric timeline',()=>{
 const d=JSON.parse(fs.readFileSync('static/library/s7ea528419084.json'));assert.equal(d.instrumental,true);assert.equal(d.reviewNeeded,false);assert.deepEqual(resolveLyricLines(d),[]);assert.equal(d.syncSegments[0].kind,'pure-instrumental')
})
test('Published lyric metadata credits are excluded from sung lines',async()=>{
 const {fromPublishedLrc}=await import('../scripts/lib/published-lyrics.mjs');const d=fromPublishedLrc('[00:00]演唱：歌手\n[00:02]专辑：名称\n[00:05]实际歌词',20);assert.deepEqual(d.canonical,['实际歌词']);
 const actual=JSON.parse(fs.readFileSync('static/library/sd00c5a757d6f.json'));assert.equal(actual.reviewNeeded,false);assert.ok(!actual.canonical.some(x=>x.includes('渺小卑微')))
})
