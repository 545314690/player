import argparse,json,struct,pathlib,numpy as np,torch,time
import whisper
from opencc import OpenCC
parser=argparse.ArgumentParser(description='Offline review only; raw ASR is never directly published.')
parser.add_argument('--model',type=pathlib.Path,required=True);parser.add_argument('--media',type=pathlib.Path,required=True);parser.add_argument('ids',nargs='+');args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];modelpath=args.model;media=args.media
torch.set_num_threads(6)
config=json.loads((modelpath/'config.json').read_text());config.pop('quantization');config.pop('model_type');print('Loading CPU model',flush=True)
with (modelpath/'model.safetensors').open('rb') as f:length=struct.unpack('<Q',f.read(8))[0];header=json.loads(f.read(length))
offset=8+length
def tensor(key):
 h=header[key];dtype={'F16':'<f2','F32':'<f4','U32':'<u4','I64':'<i8'}[h['dtype']];return np.memmap(modelpath/'model.safetensors',dtype=dtype,mode='r',offset=offset+h['data_offsets'][0],shape=tuple(h['shape']))
model=whisper.Whisper(whisper.ModelDimensions(**config)).eval()
with torch.no_grad():
 for key,param in model.named_parameters():
  if key=='encoder.positional_embedding':continue
  source=key.replace('.mlp.0.','.mlp1.').replace('.mlp.2.','.mlp2.')
  a=tensor(source)
  if source.removesuffix('.weight')+'.scales' in header and source.endswith('.weight'):
   prefix=source.removesuffix('.weight');unpacked=((a[:,:,None]>>np.arange(0,32,4,dtype=np.uint32))&15).reshape(a.shape[0],-1).astype(np.float32)
   a=unpacked*np.repeat(tensor(prefix+'.scales').astype(np.float32),64,axis=1)+np.repeat(tensor(prefix+'.biases').astype(np.float32),64,axis=1)
  if 'conv' in key and a.ndim==3:a=a.swapaxes(1,2)
  param.copy_(torch.from_numpy(np.array(a,dtype=np.float32)))
 # Use the checkpoint's own alignment-head selection.
 heads=torch.from_numpy(np.array(tensor('alignment_heads')));mask=torch.zeros(config['n_text_layer'],config['n_text_head'],dtype=torch.bool);mask[heads[:,0],heads[:,1]]=True;model.alignment_heads=mask.to_sparse()
print('Model ready',flush=True)
cc=OpenCC('t2s');cat=json.loads((root/'static/library/catalog.json').read_text());ids=args.ids
for ident in ids:
 track=next(x for x in cat if x['id']==ident);out=root/'docs/lyric-audio-review'/f'{ident}.json'
 if out.exists():continue
 print('Transcribing',track['file'],flush=True);start=time.time()
 result=model.transcribe(str(media/track['file']),language='zh',fp16=False,word_timestamps=True,temperature=0,condition_on_previous_text=False,verbose=False)
 lines=[]
 for seg in result['segments']:
  words=seg.get('words',[]);parts=[]
  for w in words:
   if w['end']<=w['start']:continue
   if parts and (w['start']-parts[-1]['end']>1.8 or (parts[-1]['end']-parts[0]['start']>6 and len(''.join(x['word'] for x in parts))>=6)):
    lines.append({'time':round(parts[0]['start'],2),'end':round(parts[-1]['end'],2),'text':cc.convert(''.join(x['word'] for x in parts)).strip()});parts=[]
   parts.append(w)
  if parts:lines.append({'time':round(parts[0]['start'],2),'end':round(parts[-1]['end'],2),'text':cc.convert(''.join(x['word'] for x in parts)).strip()})
 out.write_text(json.dumps({'id':ident,'file':track['file'],'model':'whisper-large-v3-turbo MLX q4 weights dequantized to CPU','seconds':round(time.time()-start,1),'lines':lines,'segments':result['segments']},ensure_ascii=False,indent=2));print('DONE',ident,round(time.time()-start,1),len(lines),flush=True)
