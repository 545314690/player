const SITE_AUDIO = 'https://zm.ysaw.top/songs/assets/media/'
const ARCHIVE_AUDIO = 'https://raw.githubusercontent.com/545314690/player/1abd9c78131f47c0885cc8393eefa2f921163944/public/assets/media/'
export function audioSources(track) {
  const file=track.file || (track.src ? decodeURIComponent(new URL(track.src).pathname.split('/').pop()) : '')
  const candidates=[file?SITE_AUDIO+encodeURIComponent(file):track.src, ...(track.sources||[]), track.src, file?ARCHIVE_AUDIO+encodeURIComponent(file):null]
  return [...new Set(candidates.filter(Boolean).map(src=>new URL(src).href))]
}
export function sameAudioFile(a,b) {
  try {return decodeURIComponent(new URL(a).pathname.split('/').pop())===decodeURIComponent(new URL(b).pathname.split('/').pop())}catch{return false}
}
