import argparse,json,pathlib,hashlib
p=argparse.ArgumentParser();p.add_argument('start',type=int,nargs='?',default=0);p.add_argument('--count',type=int,default=20);p.add_argument('--mark',action='store_true');args=p.parse_args()
ROOT=pathlib.Path(__file__).resolve().parents[1];BASE=ROOT/'docs/lyric-audio-review';batch=pathlib.Path('/tmp/praise-text-review-batch.json');progress=BASE/'text-proofread.json'
def digest(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False).encode()).hexdigest()
if args.mark:
 reviewed=json.loads(progress.read_text()) if progress.exists() else {}
 for row in json.loads(batch.read_text()):
  current=json.loads((BASE/'proposed-corrections'/(row['id']+'.json')).read_text())
  if digest(current['canonical'])!=row['hash']:raise RuntimeError('Text changed after printing '+row['id'])
  reviewed[row['id']]={'canonicalHash':row['hash'],'status':'Chinese/English wording read; audio verification is tracked separately'}
 progress.write_text(json.dumps(reviewed,ensure_ascii=False,indent=2));print('Recorded text review:',len(reviewed));raise SystemExit
cat=json.loads((ROOT/'static/library/catalog.json').read_text());rows=[]
for i,t in enumerate(cat[args.start:args.start+args.count],args.start):
 d=json.loads((BASE/'proposed-corrections'/(t['id']+'.json')).read_text());print(i,t['id'],t['file']);print(' / '.join(d['canonical']));rows.append({'id':t['id'],'hash':digest(d['canonical'])})
batch.write_text(json.dumps(rows))
