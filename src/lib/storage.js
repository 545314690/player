export const STORAGE_KEY = 'praise-player-v1'
const themes = ['black','green','pink','white']
export const defaults = () => ({version:1,settings:{theme:'black',fontSize:17,volume:0.8,repeat:'list',shuffle:false},favorites:[],playlists:[],recent:[],corrections:{},offsets:{},playback:{trackId:null,position:0,queue:[]}})
const uniqueIds = value => Array.isArray(value) ? [...new Set(value.filter(x=>typeof x==='string'))].slice(0,2000) : []
export function validateState(input) {
  if (!input || typeof input!=='object' || input.version!==1) throw new Error('备份格式不正确，请选择本应用导出的 JSON 文件。')
  const d=defaults(), s=input.settings||{}
  d.settings={theme:themes.includes(s.theme)?s.theme:'black',fontSize:Math.min(24,Math.max(14,Number(s.fontSize)||17)),volume:Math.min(1,Math.max(0,Number.isFinite(s.volume)?s.volume:.8)),repeat:s.repeat==='one'?'one':'list',shuffle:s.repeat!=='one'&&s.shuffle===true}
  d.favorites=uniqueIds(input.favorites); d.recent=uniqueIds(input.recent).slice(0,60)
  d.playlists=(Array.isArray(input.playlists)?input.playlists:[]).filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string').slice(0,200).map(p=>({id:p.id,name:p.name.slice(0,60),tracks:uniqueIds(p.tracks)}))
  d.corrections=Object.fromEntries(Object.entries(input.corrections||{}).filter(([k,v])=>/^s[a-f0-9]{12}$/.test(k)&&typeof v==='string'&&v.length<100000))
  d.offsets=Object.fromEntries(Object.entries(input.offsets||{}).filter(([k,v])=>/^s[a-f0-9]{12}$/.test(k)&&Number.isFinite(v)&&Math.abs(v)<=60))
  if (input.playback) d.playback={trackId:typeof input.playback.trackId==='string'?input.playback.trackId:null,position:Math.max(0,Number(input.playback.position)||0),queue:uniqueIds(input.playback.queue)}
  return d
}
export function loadState() { try {const value=localStorage.getItem(STORAGE_KEY);return value?validateState(JSON.parse(value)):defaults()} catch {return defaults()} }
export function saveState(state) { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)) }
export function importBackup(text) {if (text.length>5000000) throw new Error('备份文件过大。'); const input=JSON.parse(text);return validateState(input.data||input)}
export function exportBackup(state) {return JSON.stringify({app:'praise-player',exportedAt:new Date().toISOString(),data:state},null,2)}
