"""Independent sound-event evidence for suspected instrumental recordings; not lyric copy."""
import argparse,csv,json,pathlib,subprocess,numpy as np,torch
from torch import nn
from torch.nn import functional as F
ROOT=pathlib.Path(__file__).resolve().parents[1];BASE=ROOT/'docs/lyric-audio-review';OUT=BASE/'vocal-presence';OUT.mkdir(exist_ok=True)
parser=argparse.ArgumentParser();parser.add_argument('ids',nargs='*');args=parser.parse_args();torch.set_num_threads(2)
labels=[x['display_name'] for x in csv.DictReader(open('/tmp/praise-panns-labels.csv'))];state=torch.load('/tmp/praise-panns-cnn6.pth',map_location='cpu',weights_only=True)['model']
class Block(nn.Module):
 def __init__(self,a,b):super().__init__();self.conv1=nn.Conv2d(a,b,5,padding=2,bias=False);self.bn1=nn.BatchNorm2d(b)
 def forward(self,x):return F.avg_pool2d(F.relu_(self.bn1(self.conv1(x))),2)
class Cnn6(nn.Module):
 def __init__(self):
  super().__init__();self.bn0=nn.BatchNorm2d(64)
  for i,(a,b) in enumerate([(1,64),(64,128),(128,256),(256,512)],1):setattr(self,'conv_block'+str(i),Block(a,b))
  self.fc1=nn.Linear(512,512);self.fc_audioset=nn.Linear(512,527)
 def forward(self,wave):
  x=F.pad(wave.unsqueeze(1),(512,512),mode='reflect');real=F.conv1d(x,state['spectrogram_extractor.stft.conv_real.weight'],stride=320);imag=F.conv1d(x,state['spectrogram_extractor.stft.conv_imag.weight'],stride=320)
  x=(real.square()+imag.square()).transpose(1,2).unsqueeze(1);x=10*torch.log10(torch.clamp(x@state['logmel_extractor.melW'],min=1e-10));x=self.bn0(x.transpose(1,3)).transpose(1,3)
  for i in range(1,5):x=getattr(self,'conv_block'+str(i))(x)
  x=x.mean(dim=3);x=x.max(dim=2).values+x.mean(dim=2);return torch.sigmoid(self.fc_audioset(F.relu_(self.fc1(x))))
model=Cnn6().eval();model.load_state_dict({k:v for k,v in state.items() if not k.startswith(('spectrogram_extractor.','logmel_extractor.'))})
cat=json.loads((ROOT/'static/library/catalog.json').read_text());inventory={x['id']:x for x in json.loads((BASE/'inventory.json').read_text())};wanted=set(args.ids);MEDIA=pathlib.Path('/Users/lism/Program/WebStormProjects/hello-world/public/assets/media')
for t in cat:
 if wanted and t['id'] not in wanted:continue
 p=OUT/(t['id']+'.json')
 if p.exists():continue
 duration=inventory[t['id']]['duration'];clips=[];starts=[]
 for frac in [.12,.26,.4,.54,.68,.82]:
  start=min(max(0,duration-10),duration*frac);r=subprocess.run(['ffmpeg','-v','error','-ss',str(start),'-t','10','-i',str(MEDIA/t['file']),'-f','f32le','-ac','1','-ar','32000','-'],capture_output=True)
  a=np.frombuffer(r.stdout,dtype='<f4').copy()
  if len(a)<320000:a=np.pad(a,(0,320000-len(a)))
  clips.append(a[:320000]);starts.append(round(start,2))
 with torch.inference_mode():scores=model(torch.from_numpy(np.stack(clips))).numpy()
 keys=['Singing','Choir','Speech','Piano','Electric piano','Music','Musical instrument'];windows=[dict(time=time,tags={k:round(float(row[labels.index(k)]),5) for k in keys if k in labels},top=[dict(label=labels[i],score=round(float(row[i]),5)) for i in row.argsort()[-5:][::-1]]) for time,row in zip(starts,scores)]
 doc=dict(id=t['id'],file=t['file'],model='PANNs Cnn6_mAP=0.343 official AudioSet checkpoint',source='https://zenodo.org/records/3987831',policy='auxiliary instrument/voice evidence; scores are not proof of lyric completeness',windows=windows);p.write_text(json.dumps(doc,ensure_ascii=False,indent=2));print(t['file'],[(w['time'],w['top'][0]) for w in windows],flush=True)
