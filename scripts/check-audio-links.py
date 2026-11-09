"""HEAD-check every primary audio link; never download the library."""
import concurrent.futures,json,pathlib,subprocess,time
root=pathlib.Path(__file__).resolve().parents[1]
rows=json.loads((root/'static/library/catalog.json').read_text())
def check(t):
 result=subprocess.run(['curl','--silent','--show-error','--head','--location','--max-time','18','--retry','1','--output','/dev/null','--write-out','%{http_code} %{content_type}',t['src']],capture_output=True,text=True)
 parts=result.stdout.split(' ',1);code=parts[0];mime=parts[1] if len(parts)>1 else ''
 return {'id':t['id'],'song':t['title'],'status':code,'type':mime,'ok':result.returncode==0 and code=='200' and ('audio/' in mime or 'octet-stream' in mime)}
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=10)as pool:
 for result in pool.map(check,rows):results.append(result)
report={'checked':len(results),'passed':sum(r['ok'] for r in results),'failed':[r for r in results if not r['ok']]}
(root/'docs/audio-link-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
