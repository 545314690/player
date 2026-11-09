"""Waveform proof for formal LRC. Titles and metadata never prove a recording match."""
import concurrent.futures,hashlib,json,pathlib,subprocess,threading,time
import numpy as np
from scipy.signal import correlate
ROOT=pathlib.Path(__file__).resolve().parents[1];BASE=ROOT/'docs/lyric-audio-review';OUT=BASE/'recording-matches';OUT.mkdir(exist_ok=True);CACHE=pathlib.Path('/tmp/praise-source-audio');CACHE.mkdir(exist_ok=True)
MEDIA=pathlib.Path('/Users/lism/Program/WebStormProjects/hello-world/public/assets/media');RATE=2000
cat=json.loads((ROOT/'static/library/catalog.json').read_text());locks={};guard=threading.Lock()
def pcm(path):return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-f','f32le','-ac','1','-ar',str(RATE),'-']),dtype='<f4').copy()
def reference(sid,source):
 with guard:lock=locks.setdefault(sid,threading.Lock())
 with lock:
  p=CACHE/(sid+'.npy')
  if p.exists():return np.load(p)
  temp=CACHE/(sid+'.mp3')
  try:
   subprocess.run(['curl','--connect-timeout','5','--max-time','20','-fsSL',source['audio'],'-o',str(temp)],check=True,capture_output=True);a=pcm(temp);np.save(p,a);return a
  finally:temp.unlink(missing_ok=True)
def compare(local,remote):
 c=correlate(remote,local,method='fft');shift=int(np.abs(c).argmax())-(len(local)-1);scores=[]
 for frac in [.08,.2,.32,.44,.56,.68,.8,.9]:
  start=int(len(local)*frac);end=min(start+RATE*5,len(local));a=local[start:end];p=start+shift;lo=max(0,p-2*RATE);hi=min(len(remote),p+len(a)+2*RATE)
  if hi-lo<len(a):continue
  r=remote[lo:hi];v=correlate(r,a,mode='valid',method='fft');squares=np.concatenate(([0],np.cumsum(r.astype(np.float64)**2)));norm=np.sqrt(np.maximum(1e-15,squares[len(a):]-squares[:-len(a)]))*np.linalg.norm(a);coeff=np.abs(v)/np.maximum(norm,1e-15);index=int(coeff.argmax());score=float(coeff[index]);pos=lo+index
  scores.append(dict(localStart=round(start/RATE,3),sourceStart=round(pos/RATE,3),offset=round((pos-start)/RATE,5),coefficient=round(score,6)))
 trusted=[x for x in scores if x['coefficient']>=.8];scale=1.;offset=shift/RATE;residual=999
 if len(trusted)>=5:
  x=np.array([v['localStart'] for v in trusted]);y=np.array([v['sourceStart'] for v in trusted]);scale,offset=np.polyfit(x,y,1);residual=float(np.max(np.abs(y-(scale*x+offset))))
 duration=len(local)/RATE;sourceDuration=len(remote)/RATE;covered=max(0,min(duration,(sourceDuration-offset)/scale)-max(0,-offset/scale))/duration
 accepted=len(trusted)>=6 and residual<=.025 and .98<=scale<=1.02 and covered>=.98
 return dict(offset=round(float(offset),6),scale=round(float(scale),9),residual=round(residual,6),coverage=round(covered,6),windows=scores,accepted=bool(accepted))

def track(t):
 out=OUT/(t['id']+'.json')
 if out.exists() and json.loads(out.read_text()).get('algorithm')==2:return
 path=BASE/'source-candidates'/(t['id']+'.json')
 if not path.exists():return
 row=json.loads(path.read_text());candidates=row.get('candidates',[]);attempts=[];local=None;match=None
 for candidate in candidates:
  sid=candidate['id'];p=BASE/'sources'/(sid+'.json')
  if not p.exists():continue
  source=json.loads(p.read_text())
  if not source.get('audio'):continue
  try:
   if local is None:local=pcm(MEDIA/t['file'])
   r=reference(sid,source);proof=compare(local,r);attempts.append(dict(source=sid,**proof))
   if proof['accepted']:match=dict(source=sid,url=source['url'],audio=source['audio'],**proof);break
  except Exception as e:attempts.append(dict(source=sid,error=str(e)[:120]))
 out.write_text(json.dumps(dict(id=t['id'],file=t['file'],algorithm=2,match=match,attempts=attempts),ensure_ascii=False,indent=2));print('MATCH' if match else 'NO MATCH',t['file'],match['source'] if match else len(attempts),flush=True)
# Discovery is checkpointed independently; consume files as they arrive.
while True:
 pending=[t for t in cat if (BASE/'source-candidates'/(t['id']+'.json')).exists() and (not (OUT/(t['id']+'.json')).exists() or json.loads((OUT/(t['id']+'.json')).read_text()).get('algorithm')!=2)]
 if pending:
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(track,pending))
 if all((OUT/(t['id']+'.json')).exists() and json.loads((OUT/(t['id']+'.json')).read_text()).get('algorithm')==2 for t in cat) and not pathlib.Path('/tmp/praise-source-expansion-running').exists():break
 if not pending:time.sleep(5)
