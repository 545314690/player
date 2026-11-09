import fs from 'node:fs'
// Ship only the latest player data. Legacy ASR and review archives remain in
// repository docs, never in the public lyric response or APK assets.
for(const name of fs.readdirSync('dist/library')){
 if(!/^s[a-f0-9]{12}\.json$/.test(name))continue
 const path='dist/library/'+name,doc=JSON.parse(fs.readFileSync(path)),published={}
 for(const key of ['instrumental','lrc','canonical','syncSegments','syncIssue','reviewNeeded','syncCoverage','revision','timingRevision','audioDuration'])if(doc[key]!==undefined)published[key]=doc[key]
 if(published.syncSegments)published.syncSegments=published.syncSegments.map(({time,end,text,kind})=>({time,end,text,...(kind?{kind}:{})}))
 fs.writeFileSync(path,JSON.stringify(published))
}
