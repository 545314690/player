"""Discover public lyrics without treating title similarity as recording proof."""
import concurrent.futures,html,json,pathlib,re,subprocess,time,urllib.parse
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'docs/lyric-audio-review/sources';OUT.mkdir(exist_ok=True)
CACHE=pathlib.Path('/tmp/praise-source-cache');CACHE.mkdir(exist_ok=True)
MEDIA=pathlib.Path('/Users/lism/Program/WebStormProjects/hello-world/public/assets/media')
cat=json.loads((ROOT/'static/library/catalog.json').read_text());meta={x['id']:x for x in json.loads((ROOT/'docs/lyric-audio-review/metadata.json').read_text())}
def normal(s):return re.sub(r'[^\w\u4e00-\u9fff]','',s).lower()
def fix(s):
 try:return s.encode('latin1').decode('gbk')
 except:return s

def rawtags(path):
 data=path.read_bytes();tags={}
 if data[:3]==b'ID3':
  version=data[3];limit=sum(data[6+i]<<(7*(3-i)) for i in range(4))+10;pos=10
  while pos+10<min(limit,len(data)):
   key=data[pos:pos+4].decode('ascii',errors='ignore');b=data[pos+4:pos+8];size=sum(b[i]<<(7*(3-i)) for i in range(4)) if version==4 else int.from_bytes(b,'big');body=data[pos+10:pos+10+size];pos+=10+size
   if not size:break
   if key in ['TIT2','TPE1','TALB'] and body:
    enc=body[0];raw=body[1:]
    for codec in ({0:['utf-8','gbk','latin1'],1:['utf-16'],2:['utf-16-be'],3:['utf-8','gbk']}.get(enc,[])):
     try:tags[{'TIT2':'title','TPE1':'artist','TALB':'album'}[key]]=fix(raw.decode(codec).strip('\x00'));break
     except UnicodeError:pass
 return tags
for t in cat:
 m=meta[t['id']];m.update(rawtags(MEDIA/t['file']))
 for k in ['title','artist','album']:m[k]=fix(m.get(k,''))
(ROOT/'docs/lyric-audio-review/metadata-corrected.json').write_text(json.dumps(list(meta.values()),ensure_ascii=False,indent=2))
def get(url,cache):
 p=CACHE/cache
 if p.exists():return p.read_text()
 time.sleep(.25)
 r=subprocess.run(['curl','--connect-timeout','8','--max-time','25','-fsSL',url],capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr.decode(errors='replace')[-120:])
 text=r.stdout.decode('utf8',errors='replace');p.write_text(text);return text

def candidates(title):
 key=urllib.parse.quote(title,safe='');s=BeautifulSoup(get('https://www.izanmei.cc/search/search?'+urllib.parse.urlencode({'autocomplete':title,'type':13}),'search-'+key+'.html'),'html.parser');rows=[]
 for td in s.select('td.name'):
  a=td.select_one('a[href^="/song/"]')
  if not a:continue
  sid=re.search(r'/song/(\d+)\.html',a.get('href',''))
  if not sid:continue
  artist=td.select_one('a[href^="/artist/"]');album=td.select_one('a[href^="/album/"]')
  rows.append(dict(id=sid[1],title=a.get_text('',strip=True),artist=artist.get_text('',strip=True) if artist else '',album=album.get_text('',strip=True).strip('《》') if album else ''))
 return rows

def source(sid):
 p=OUT/(sid+'.json')
 if p.exists():return json.loads(p.read_text())
 url='https://www.izanmei.cc/song/'+sid+'.html';s=BeautifulSoup(get(url,'song-'+sid+'.html'),'html.parser');copy=s.select_one('#lyrics [data-clipboard-text]');text=copy.get('data-clipboard-text','') if copy else '';lrc=s.select_one('a[href*="/down/lyric/"]');audio=s.select_one('a[href^="https://play.izanm.org/song/p/"]');doc=dict(id=sid,url=url,plain=text,audio=audio.get('href') if audio else None)
 if lrc:
  doc['lyricUrl']=urllib.parse.urljoin(url,lrc.get('href'))
  try:doc['lrc']=get(doc['lyricUrl'],'lrc-'+sid+'.txt')
  except Exception as e:doc['lrcError']=str(e)
 p.write_text(json.dumps(doc,ensure_ascii=False,indent=2));return doc

def track(t):
 p=ROOT/'docs/lyric-audio-review/source-candidates'/ (t['id']+'.json');p.parent.mkdir(exist_ok=True)
 if p.exists() and not json.loads(p.read_text()).get('error'):return
 m=meta[t['id']];title=m.get('providerTitle') or m.get('title') or t['title'];title=re.sub(r'^\d+[.、 _-]*','',title).strip()
 if '\ufffd' in title or not title:title=t['title']
 artist=m.get('artist','');album=m.get('album','');rows=[]
 try:
  rows=candidates(title)
  # An alternate is grounded in this file's catalog, never generated title guesses.
  if not rows and normal(title)!=normal(t['title']):rows=candidates(t['title'])
  for r in rows:r['rank']=(4 if normal(r['title'])==normal(title) else 0)+(5 if normal(artist) and normal(artist)==normal(r['artist']) else 0)+(3 if normal(album) and normal(album)==normal(r['album']) else 0)
  rows.sort(key=lambda r:-r['rank']);selected=rows[:4]
  for r in selected:
   try:source(r['id'])
   except Exception as e:r['error']=str(e)
  result=dict(id=t['id'],file=t['file'],query=title,metadata=m,candidates=selected,totalCandidates=len(rows))
 except Exception as e:result=dict(id=t['id'],file=t['file'],error=str(e))
 p.write_text(json.dumps(result,ensure_ascii=False,indent=2));print('SOURCE',t['file'],len(result.get('candidates',[])),flush=True)
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(track,cat))
