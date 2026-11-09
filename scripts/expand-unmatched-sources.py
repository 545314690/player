"""Expand actual search results for recordings not identified in the first pass."""
import importlib.util,pathlib,json,re,concurrent.futures
spec=importlib.util.spec_from_file_location('discovery',pathlib.Path(__file__).with_name('discover-lyric-sources.py'));d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
BASE=d.ROOT/'docs/lyric-audio-review';OUT=BASE/'expanded-candidates';OUT.mkdir(exist_ok=True)
normal=lambda x:re.sub(r'[^\w]','',x).replace('祂','他').replace('祢','你').lower()
def grams(x):x=normal(x);return {x[i:i+3] for i in range(len(x)-2)}
def track(t):
 result=BASE/'recording-matches'/(t['id']+'.json');match=json.loads(result.read_text()) if result.exists() else {}
 if match.get('match'):return
 out=OUT/(t['id']+'.json')
 if out.exists():return
 old=json.loads((BASE/'source-candidates'/(t['id']+'.json')).read_text());query=old.get('query') or t['title'];book=json.loads((d.ROOT/'static/library'/(t['id']+'.json')).read_text());expected=grams(''.join(book['canonical']));rows=[]
 try:
  rows=d.candidates(query)
  # Direct details already found through source search.
  if t['id']=='s99d10b25c4ce':rows.insert(0,dict(id='909',title='阿爸父',artist='我心旋律',album='天父',rank=15))
  if t['file'].startswith('016'):rows.insert(0,dict(id='4116',title='除你以外',artist='华人创作',album='除你以外',rank=15))
  for r in rows:
   try:
    doc=d.source(r['id']);available=grams(doc.get('plain',''));r['songbookOverlap']=round(len(expected&available)/max(1,len(expected)),4)
   except Exception as e:r['error']=str(e)
  relevant=[r for r in rows if r.get('songbookOverlap',0)>=.2]
  selected=relevant if relevant else rows
  # Keep the metadata's own artist even when a songbook mismatch was detected.
  artist=normal(old.get('metadata',{}).get('artist',''))
  for r in rows:
   if artist and normal(r.get('artist',''))==artist and r not in selected:selected.append(r)
  combined={r['id']:r for r in old.get('candidates',[])+selected};old['candidates']=sorted(combined.values(),key=lambda r:-(r.get('songbookOverlap',0)+(.5 if artist and normal(r.get('artist',''))==artist else 0)+(1 if r.get('rank',0)==15 else 0)));old['expanded']=True
  (BASE/'source-candidates'/(t['id']+'.json')).write_text(json.dumps(old,ensure_ascii=False,indent=2));out.write_text(json.dumps(dict(id=t['id'],file=t['file'],candidates=len(old['candidates']),searched=len(rows)),ensure_ascii=False,indent=2))
  result.unlink(missing_ok=True);print('EXPAND',t['file'],len(old['candidates']),flush=True)
 except Exception as e:print('EXPAND ERROR',t['file'],str(e),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(track,d.cat))
