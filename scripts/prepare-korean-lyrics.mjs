import fs from 'node:fs'
const ids=['s5ee01e3832a5','sef60b84e9c0b']
for(const id of ids){const p=`static/library/${id}.json`;const d=JSON.parse(fs.readFileSync(p));d.syncSegmentsKo=(d.syncSegments||[]).map(x=>({...x,text:x.text}));d.lyricLanguages=['zh','ko'];d.koreanTranslation={status:'source-original',note:'韩文原唱歌词，与中文翻译共用同一音频时间轴。'};fs.writeFileSync(p,JSON.stringify(d))}
