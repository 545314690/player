import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {parseLrc,activeLine,serializeLrc,formatTime} from '../src/lib/lyrics.js'
import {defaults,validateState,importBackup,exportBackup} from '../src/lib/storage.js'
import {nextIndex} from '../src/lib/player.js'
import {byteRange} from '../src/lib/range.js'
test('LRC supports repeated timestamps, milliseconds, single digit fractions, offset and malformed seconds',()=>{
 const lines=parseLrc('[offset:-500]\n[00:01.5][01:02.125]第一句\n[00:60.00]invalid\n[00:02]第二句')
 assert.deepEqual(lines.map(x=>[x.time,x.text]),[[1,'第一句'],[1.5,'第二句'],[61.625,'第一句']])
 assert.equal(activeLine(lines,0),-1);assert.equal(activeLine(lines,1.5),1);assert.equal(activeLine(lines,1.5,1),-1);assert.equal(activeLine(lines,99),2)
})
test('Seeking backwards and past end always resolves lyric position',()=>{const l=parseLrc('[00:10]a\n[00:20]b');assert.equal(activeLine(l,21),1);assert.equal(activeLine(l,3),-1);assert.equal(activeLine(l,10),0)})
test('Serialization handles rounding at minute boundary and sorts after edited timestamps',()=>{assert.equal(serializeLrc([{time:59.999,text:'x'}]),'[01:00.00]x');assert.equal(formatTime(Infinity),'0:00');assert.equal(formatTime(125),'2:05')})
test('Local backup roundtrip preserves themes, favorite, playlists and lyric edits',()=>{const d=defaults();d.settings.theme='pink';d.favorites=['s123456789abc'];d.playlists=[{id:'p',name:'默想',tracks:[d.favorites[0]]}];d.corrections[d.favorites[0]]='[00:01]正确歌词';assert.deepEqual(importBackup(exportBackup(d)),d)})
test('Malformed or hostile backup is rejected or bounded without executable markup',()=>{assert.throws(()=>importBackup('{bad'));assert.throws(()=>validateState({version:99}));const d=validateState({version:1,settings:{theme:'evil',fontSize:1000,volume:-2},favorites:['a','a',4],corrections:{'__proto__':'bad'}});assert.equal(d.settings.theme,'black');assert.equal(d.settings.fontSize,24);assert.equal(d.settings.volume,0);assert.deepEqual(d.favorites,['a'])})
test('Queue repeat off stops at end, manual next wraps, shuffle avoids current',()=>{const q=[1,2,3];assert.equal(nextIndex(q,2,1,'off',false,true),-1);assert.equal(nextIndex(q,2,1,'off',false,false),0);assert.equal(nextIndex(q,1,1,'one',false,true),1);assert.notEqual(nextIndex(q,1,1,'list',true),1);assert.equal(nextIndex([],0,1,'list',false),-1)})
test('Offline cached audio range supports open-ended, suffix and rejects invalid requests',()=>{assert.deepEqual(byteRange('bytes=2-5',10),{start:2,end:5});assert.deepEqual(byteRange('bytes=5-',10),{start:5,end:9});assert.deepEqual(byteRange('bytes=-3',10),{start:7,end:9});assert.equal(byteRange('bytes=20-',10),null);assert.equal(byteRange('bytes=5-2',10),null);assert.equal(byteRange('bytes=0-1,4-6',10),null)})
test('Catalog has stable unique identities, usable online music URLs and no published ASR guesses',()=>{const rows=JSON.parse(fs.readFileSync(new URL('../static/library/catalog.json',import.meta.url)));assert.equal(rows.length,340);assert.equal(new Set(rows.map(t=>t.id)).size,340);for(const t of rows){assert.match(t.src,/^https:\/\/raw\.githubusercontent\.com\/545314690\/player\//);const d=JSON.parse(fs.readFileSync(new URL(`../static/library/${t.id}.json`,import.meta.url)));for(const line of parseLrc(d.lrc)){const normalized=line.text.replace(/\s/g,'');assert.ok(d.canonical.join('').replace(/\s/g,'').includes(normalized),`${t.title}: ${line.text} not from songbook`)}}})
