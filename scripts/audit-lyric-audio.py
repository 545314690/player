"""Read-only audio identity audit. Never infer a recording match from filenames."""
import argparse,concurrent.futures,hashlib,json,pathlib,subprocess
parser=argparse.ArgumentParser();parser.add_argument('--media',type=pathlib.Path,required=True);args=parser.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];catalog=json.loads((root/'static/library/catalog.json').read_text())
def inspect(track):
 path=args.media/track['file'];duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(path)],text=True));signature=hashlib.sha256();error=False
 for fraction in [.2,.5,.8]:
  result=subprocess.run(['ffmpeg','-v','error','-ss',str(duration*fraction),'-t','8','-i',str(path),'-f','s16le','-ac','1','-ar','16000','-'],capture_output=True)
  error|=result.returncode!=0;signature.update(result.stdout)
 doc=json.loads((root/'static/library'/f"{track['id']}.json").read_text());return dict(id=track['id'],file=track['file'],duration=duration,audioHash=hashlib.sha256(path.read_bytes()).hexdigest(),lyricHash=hashlib.sha256(doc['original'].encode()).hexdigest(),pcmSignature=None if error else signature.hexdigest(),decodeError=error)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(inspect,catalog))
# Published donor mappings require full decoded equality, beyond sample matching.
for row in rows:
 if row['id'] in {'s7d549dc98ab9','sb826f339f00a','se488c9b652d7','s77dfee9e7ef7'}:
  pcm=subprocess.check_output(['ffmpeg','-v','error','-i',str(args.media/row['file']),'-f','s16le','-ac','1','-ar','16000','-']);row['fullPcmSha256']=hashlib.sha256(pcm).hexdigest()
out=root/'docs/lyric-audio-review/inventory.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(rows,ensure_ascii=False,indent=2));print(f'Audited {len(rows)} recordings; {out}')
