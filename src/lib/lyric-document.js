// An older HTTP response must never overwrite newer lyrics bundled in an APK.
export function selectLyricDocument(bundled,published){
 if(!published||typeof published.lrc!=='string'||!published.revision)return bundled
 if(bundled.revision&&String(published.revision).localeCompare(String(bundled.revision),'en',{numeric:true})<0)return bundled
 return published
}
