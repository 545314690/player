package cn.praise.player;
import org.json.*;
import java.util.*;
/** One timing implementation for foreground, notification and lock screen. */
final class LyricTimeline {
 static final class Line {final double start,end;final String text;Line(double s,double e,String t){start=s;end=e;text=t;}}
 private final ArrayList<Line> lines=new ArrayList<>();
 LyricTimeline(JSONObject document){JSONArray source=document.optJSONArray("syncSegments");if(source==null)source=document.optJSONArray("lines");if(source!=null)for(int i=0;i<source.length();i++){JSONObject row=source.optJSONObject(i);if(row==null)continue;double time=row.optDouble("time",-1),end=row.optDouble("end",Double.POSITIVE_INFINITY);String text=row.optString("text","");if(text.isEmpty()&&row.optString("kind").equals("instrumental"))text="间奏";if(text.isEmpty()&&row.optString("kind").equals("pure-instrumental"))text="纯音乐";if(time>=0&&Double.isFinite(time)&&end>time&&!text.isEmpty())lines.add(new Line(time,end,text));}lines.sort(Comparator.comparingDouble(x->x.start));}
 String at(double position,double offset){double time=position-offset;int lo=0,hi=lines.size()-1,index=-1;while(lo<=hi){int mid=(lo+hi)>>>1;if(lines.get(mid).start<=time){index=mid;lo=mid+1;}else hi=mid-1;}if(index<0||time>=lines.get(index).end)return "";return lines.get(index).text;}
}
