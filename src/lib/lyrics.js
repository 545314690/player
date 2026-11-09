/** Milliseconds and centiseconds, metadata, repeated tags and global offset. */
export function parseLrc(raw = '') {
  const offset = Number(raw.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000
  const result = []
  for (const line of raw.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const tags = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)]
    const text = line.replace(/\[[^\]]*\]/g, '').replace(/<\d{1,3}:\d{2}(?:\.\d{1,3})?>/g, '').trim()
    if (!text) continue
    for (const tag of tags) {
      if (+tag[2] >= 60) continue
      const time = +tag[1] * 60 + +tag[2] + (tag[3] ? +tag[3] / 10 ** tag[3].length : 0) + offset
      result.push({ time: Math.max(0, time), text, order: result.length })
    }
  }
  return result.sort((a, b) => a.time - b.time || a.order - b.order)
}
export function activeLine(lines, time, offset = 0) {
  let lo = 0, hi = lines.length - 1, result = -1
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (lines[mid].time <= time - offset) {result = mid; lo = mid + 1} else hi = mid - 1 }
  return result>=0 && Number.isFinite(lines[result].end) && time-offset>=lines[result].end ? -1 : result
}
export function serializeLrc(lines) {
  return lines.map(({time,text}) => {
    const centis = Math.round(Math.max(0, time) * 100)
    return `[${String(Math.floor(centis / 6000)).padStart(2,'0')}:${String(Math.floor(centis / 100) % 60).padStart(2,'0')}.${String(centis % 100).padStart(2,'0')}]${text}`
  }).join('\n')
}
export function formatTime(value = 0) { const s = Math.floor(Number.isFinite(value) ? Math.max(0,value) : 0); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` }

export function resolveLyricLines(doc={},correction){
  if(correction!==undefined)return parseLrc(correction)
  if(Array.isArray(doc.syncSegments))return doc.syncSegments.filter(x=>x.text&&Number.isFinite(x.time)&&(!Number.isFinite(x.end)||x.end>x.time)).map(({time,end,text})=>({time,end,text})).sort((a,b)=>a.time-b.time)
  return parseLrc(doc.lrc||'')
}
