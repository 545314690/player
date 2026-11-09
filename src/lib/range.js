export function byteRange(header,length){
  const m=/^bytes=(\d*)-(\d*)$/.exec(header||'')
  if(!m||(!m[1]&&!m[2])||length<=0)return null
  let start=m[1]?Number(m[1]):Math.max(0,length-Number(m[2]))
  let end=m[1]?(m[2]?Math.min(Number(m[2]),length-1):length-1):length-1
  if(start>=length||start>end||start<0)return null
  return {start,end}
}
