"""Import the read-only legacy catalog; never overwrite legacy source/media.
Only unambiguous, high-confidence text repairs are applied. Every repair is logged.
Timing is preserved; uncertain recognition remains flagged for human review.
"""
import ast, pathlib, re, json, hashlib, difflib, collections, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=pathlib.Path('/Users/lism/Program/WebStormProjects/hello-world')
FALLBACK=pathlib.Path('/Users/lism/Program/WebStormProjects/player/assets/songs')
rows=ast.literal_eval((SOURCE/'src/assets/content.js').read_text().replace('export default','',1).strip().rstrip(';'))
normalize=lambda s: re.sub(r'[^\u4e00-\u9fffA-Za-z0-9]','',s).replace('祢','你').replace('祂','他')
# Reviewed against canonical text already present in the legacy songbook.
reviewed={
 '244':{'耶和华果然成就大士':'耶和华果然成就大事','耶和华果然成就大老师':'耶和华果然成就大事'},
 '295':{'我先知道他掌管明天':'我深知道 他掌管明天','死于复活是我的自由':'死里复活，使我得自由'},
}
tracks=[]; repairs=[]; issues=[]; seen=set()
for row in rows:
 name=urllib.parse.unquote(row['src'].split('/')[-1]); ident='s'+hashlib.sha1(name.encode()).hexdigest()[:12]
 if ident in seen: continue
 seen.add(ident)
 title=re.sub(r'^\d+[.\-、_\s]*','',row['title']).strip()
 if row['number']=='295': title='因祂活着'
 canonical=row.get('texts',[])
 candidates=[SOURCE/'public/assets/media'/urllib.parse.unquote(row['lrc'].split('/')[-1]),FALLBACK/urllib.parse.unquote(row['lrc'].split('/')[-1])]
 lrcpath=next((p for p in candidates if p.exists()),None)
 raw=lrcpath.read_text(encoding='utf-8-sig',errors='replace') if lrcpath else ''
 original=raw; fixed=[]; uncertain=0
 for line in raw.splitlines():
  match=re.match(r'((?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+)(.*)',line)
  if not match: fixed.append(line);continue
  stamps,text=match.groups(); new=text
  if text in reviewed.get(row['number'],{}): new=reviewed[row['number']][text]
  elif normalize(text):
   # Require long near-identical text and unique best match. Canonical text wins
   # only for orthography; low confidence ASR is never silently rewritten.
   scores=sorted(((difflib.SequenceMatcher(None,normalize(text),normalize(t)).ratio(),t) for t in canonical),reverse=True)
   if scores and scores[0][0]>=0.9 and len(normalize(text))>=6 and (len(scores)==1 or scores[0][0]>scores[1][0]+0.06):new=scores[0][1]
   elif scores and scores[0][0]<0.6:uncertain+=1
  if new!=text:repairs.append({'id':ident,'song':title,'time':stamps,'before':text,'after':new,'basis':'原工程完整歌词；近似度≥0.90且唯一，或人工确认规则'})
  fixed.append(stamps+new)
 audio_local=SOURCE/'public/assets/media'/name
 if not audio_local.exists() and name=='34.我们高举双手赞美主.mp3':
  replacement=next((f for f in (SOURCE/'public/assets/media').glob('*.mp3') if '高举双手赞美主' in f.name),None)
  if replacement:
   name=replacement.name;row['src']='https://zm.ysaw.top/player/assets/media/'+name;audio_local=replacement
 if not audio_local.exists():issues.append({'id':ident,'song':title,'issue':'原工程缺少音频文件','file':name})
 if uncertain:issues.append({'id':ident,'song':title,'issue':'疑似识别错误，待逐句复核','lines':uncertain})
 suffix=re.sub(r'^\d+[.\-、_\s]*','',pathlib.Path(name).stem)
 variant=suffix if normalize(suffix)!=normalize(title) else ''
 tracks.append({'id':ident,'number':int(row['number']),'title':title,'variant':variant,'artist':'赞美诗集','letter':row.get('letter',''),'src':'https://zm.ysaw.top/songs/assets/media/'+urllib.parse.quote(name,safe=''),'file':name,'cover':'artwork/meadow.webp','texts':canonical,'reviewNeeded':uncertain>0,'available':audio_local.exists()})
 (ROOT/'static/library'/f'{ident}.json').write_text(json.dumps({'lrc':'\n'.join(fixed),'original':original,'canonical':canonical,'reviewNeeded':uncertain>0},ensure_ascii=False))
(ROOT/'static/library/catalog.json').write_text(json.dumps(tracks,ensure_ascii=False))
report={'source':str(SOURCE),'tracks':len(tracks),'numbers':len(set(t['number'] for t in tracks)),'repairs':len(repairs),'reviewNeededTracks':sum(t['reviewNeeded'] for t in tracks),'missingAudio':sum(not t['available'] for t in tracks),'changes':repairs,'issues':issues}
(ROOT/'docs/lyrics-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k not in ['changes','issues']},ensure_ascii=False))
