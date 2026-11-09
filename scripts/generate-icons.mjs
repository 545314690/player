import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {Resvg} from '@resvg/resvg-js'
const spec=JSON.parse(await readFile('design/icon.json','utf8'))
const paths=spec.paths.map(p=>`<path d="${p.d}" fill="${p.fill}"${p.stroke?` stroke="${p.stroke}" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`:''}/>`).join('')
const svg=rx=>`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><rect width="192" height="192" rx="${rx}" fill="${spec.background}"/>${paths}</svg>`
await writeFile('static/icon.svg',svg(44)+'\n')
// Same book geometry, theme-only palette; system launcher identity stays unchanged.
await writeFile('static/icon-black-gold.svg',svg(44).replaceAll(spec.background,'#090909').replaceAll('#B7CDB5','#D6B570').replaceAll('#D7BC7E','#E2C68D')+'\n')
for(const size of [192,512]){
 const image=new Resvg(svg(0),{fitTo:{mode:'width',value:size}}).render().asPng()
 await writeFile(`static/icon-${size}.png`,image)
}
await writeFile('android/app/src/main/res/values/colors.xml',`<resources><color name="launcher_background">${spec.background}</color></resources>\n`)
const native=mono=>spec.paths.map(p=>` <path android:pathData="${p.d}" android:fillColor="${p.fill==='none'?'#00000000':mono?'#FFFFFF':p.fill}"${p.stroke?` android:strokeColor="${mono?'#FFFFFF':p.stroke}" android:strokeWidth="${p.strokeWidth}" android:strokeLineCap="round" android:strokeLineJoin="round"`:''}/>`).join('\n')
await writeFile('android/app/src/main/res/drawable/ic_launcher_foreground.xml',`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="192" android:viewportHeight="192">\n${native(false)}\n</vector>\n`)
await writeFile('android/app/src/main/res/drawable/ic_music.xml',`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="144" android:viewportHeight="144"><group android:translateX="-24" android:translateY="-24">\n${native(true)}\n</group></vector>\n`)
console.log('Generated one identity: web SVG, PWA PNGs, native adaptive foreground and monochrome notification icon.')
