"""Full-audio review with local whisper.cpp; checkpointed, raw results never published."""
import base64,json,pathlib,subprocess,time,re
from opencc import OpenCC
import whisper
ROOT=pathlib.Path(__file__).resolve().parents[1];BASE=ROOT/'docs/lyric-audio-review';OUT=BASE/'full-audio';OUT.mkdir(exist_ok=True)
TEMP=pathlib.Path('/tmp/praise-full-audio');TEMP.mkdir(exist_ok=True);MEDIA=pathlib.Path('/Users/lism/Program/WebStormProjects/hello-world/public/assets/media')
MODEL='/tmp/praise-whisper-cpp/ggml-praise-turbo.bin';CLI='/tmp/praise-whisper-cpp/build/bin/whisper-cli';cc=OpenCC('t2s')
assets=pathlib.Path(whisper.__file__).parent/'assets';vocab={int(line.split()[1]):base64.b64decode(line.split()[0]) for line in (assets/'multilingual.tiktoken').read_bytes().splitlines() if line}
cat=json.loads((ROOT/'static/library/catalog.json').read_text());inv={x['id']:x for x in json.loads((BASE/'inventory.json').read_text())}
def identity(t):return inv[t['id']].get('fullPcmSha256') or inv[t['id']]['audioHash']
def language(t):return 'ko' if '韩文' in t['file'] else 'en' if t['file']=='055-英.mp3' else 'zh'
def export(t,raw):
 # Token JSON can contain incomplete UTF-8 byte tokens. Decode by token ID instead.
 segments=json.loads(raw.decode('utf8',errors='replace'))['transcription'];words=[]
 for seg in segments:
  buf=b'';start=None;last=None;prob=1
  for tok in seg.get('tokens',[]):
   if tok['id'] not in vocab:continue
   point=tok.get('t_dtw',-1)
   if point<0:continue
   if start is None:start=point/100
   last=point/100;prob=min(prob,tok.get('p',0));buf+=vocab[tok['id']]
   try:text=buf.decode('utf8')
   except UnicodeDecodeError:continue
   if text.strip():words.append(dict(time=round(max(0,start-.12),2),end=round(last+.18,2),text=cc.convert(text) if language(t)=='zh' else text,probability=round(prob,4)))
   buf=b'';start=None;prob=1
 lines=[];part=[]
 for w in words:
  if part and (w['time']-part[-1]['end']>1.2 or (part[-1]['end']-part[0]['time']>5.5 and len(''.join(x['text'] for x in part))>=7)):
   lines.append(dict(time=part[0]['time'],end=min(part[-1]['end'],w['time']),text=''.join(x['text'] for x in part).strip(),words=part));part=[]
  part.append(w)
 if part:lines.append(dict(time=part[0]['time'],end=part[-1]['end'],text=''.join(x['text'] for x in part).strip(),words=part))
 doc=dict(id=t['id'],file=t['file'],language=language(t),model='OpenAI original large-v3-turbo SHA256 aff26ae408abcba5fbf8813c21e62b0941638c5f6eebfb145be0c9839262a19a; whisper.cpp v1.7.6 Metal; no previous-text context; DTW token alignment',recordingHash=identity(t),fullDuration=inv[t['id']]['duration'],lines=lines)
 (OUT/(t['id']+'.json')).write_text(json.dumps(doc,ensure_ascii=False,indent=2));print('REVIEWED',t['file'],len(lines),flush=True)
# Recover completed files if a previous batch was interrupted.
for t in cat:
 raw=TEMP/(t['id']+'.json')
 if raw.exists() and not (OUT/(t['id']+'.json')).exists():
  try:export(t,raw.read_bytes());raw.unlink();(TEMP/(t['id']+'.wav')).unlink(missing_ok=True)
  except Exception:pass

def published_proof(t):
 p=BASE/'recording-matches'/(t['id']+'.json')
 if not p.exists():return None
 match=json.loads(p.read_text()).get('match')
 if not match or len(match['windows'])<8 or min(x['coefficient'] for x in match['windows'])<.9 or match['coverage']<.999 or match['residual']>.005:return None
 source=json.loads((BASE/'sources'/(match['source']+'.json')).read_text());lrc=source.get('lrc','');plain=source.get('plain','')
 if not lrc or not plain:return None
 plain='\n'.join(x for x in plain.splitlines() if not re.match(r'^(歌名|专辑|音乐人|点击听歌)',x.strip()))
 plain=re.sub(r'https?://\S+','',plain);lrc='\n'.join(re.sub(r'\[[^\]]*\]','',x) for x in lrc.splitlines() if not re.search(r'作词|作曲|演唱|专辑|编曲|www\.|Music|歌名',x,re.I))
 clean=lambda text:re.sub(r'[^\w]','',cc.convert(text).replace('祂','他').replace('祢','你')).lower()
 plain,lrc=clean(plain),clean(lrc)
 grams=lambda text:{text[i:i+3] for i in range(len(text)-2)}
 expected=grams(plain);coverage=len(expected&grams(lrc))/max(1,len(expected))
 if len(plain)<40 or coverage<.96:return None
 return dict(method='complete published lyric and full-recording waveform proof',source=match['source'],waveform=match,textCoverage=round(coverage,5),id=t['id'],file=t['file'],fullDuration=inv[t['id']]['duration'],recordingHash=identity(t),lines=[])

known={identity(t):t for t in cat if (OUT/(t['id']+'.json')).exists()}
for lang in ['zh','ko','en']:
 pending=[t for t in cat if language(t)==lang and not (OUT/(t['id']+'.json')).exists()]
 for offset in range(0,len(pending),8):
  batch=[]
  for t in pending[offset:offset+8]:
   if (OUT/(t['id']+'.json')).exists():continue
   proof=published_proof(t)
   if proof:
    (OUT/(t['id']+'.json')).write_text(json.dumps(proof,ensure_ascii=False,indent=2));print('FORMAL VERIFIED',t['file'],proof['source'],flush=True);continue
   if identity(t) in known and not json.loads((OUT/(known[identity(t)]['id']+'.json')).read_text()).get('method'):
    d=json.loads((OUT/(known[identity(t)]['id']+'.json')).read_text());d.update(id=t['id'],file=t['file'],identicalTo=known[identity(t)]['id']);(OUT/(t['id']+'.json')).write_text(json.dumps(d,ensure_ascii=False,indent=2));continue
   wav=TEMP/(t['id']+'.wav');subprocess.run(['ffmpeg','-v','error','-y','-i',str(MEDIA/t['file']),'-ac','1','-ar','16000',str(wav)],check=True);batch.append(t)
  if not batch:continue
  args=[CLI,'-m',MODEL,'-l',lang,'-t','4','-bs','1','-bo','1','-nf','-mc','0','-dtw','large.v3.turbo','-ojf']
  for t in batch:args+=['-f',str(TEMP/(t['id']+'.wav')),'-of',str(TEMP/t['id'])]
  with (TEMP/'engine.log').open('w') as log:subprocess.run(args,stdout=log,stderr=log,check=True)
  for t in batch:
   export(t,(TEMP/(t['id']+'.json')).read_bytes());known[identity(t)]=t
   (TEMP/(t['id']+'.wav')).unlink(missing_ok=True);(TEMP/(t['id']+'.json')).unlink(missing_ok=True)
