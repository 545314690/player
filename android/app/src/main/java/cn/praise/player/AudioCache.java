package cn.praise.player;
import android.content.Context;
import androidx.media3.common.MediaItem;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.database.StandaloneDatabaseProvider;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.datasource.cache.*;
import androidx.media3.exoplayer.offline.ProgressiveDownloader;
import java.io.File;
import java.util.concurrent.*;
import org.json.*;
@UnstableApi
public final class AudioCache {
 private static SimpleCache cache;
 private static final ConcurrentHashMap<String,String> errors=new ConcurrentHashMap<>();
 private static final ConcurrentHashMap<String,Boolean> pending=new ConcurrentHashMap<>();
 private static final ExecutorService executor=Executors.newFixedThreadPool(2);
 public static synchronized SimpleCache get(Context context){
  if(cache==null)cache=new SimpleCache(new File(context.getFilesDir(),"audio-cache"),new LeastRecentlyUsedCacheEvictor(512L*1024*1024),new StandaloneDatabaseProvider(context.getApplicationContext()));
  return cache;
 }
 public static CacheDataSource.Factory factory(Context c){return new CacheDataSource.Factory().setCache(get(c)).setUpstreamDataSourceFactory(new DefaultHttpDataSource.Factory().setUserAgent("PraisePlayer/1.0").setConnectTimeoutMs(15000).setReadTimeoutMs(20000)).setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);}
 public static String status(Context c){JSONObject out=new JSONObject();JSONArray complete=new JSONArray();JSONObject failure=new JSONObject();try{
  for(String key:get(c).getKeys()){long length=ContentMetadata.getContentLength(get(c).getContentMetadata(key));if(length>0&&get(c).isCached(key,0,length))complete.put(key);}
  for(String key:errors.keySet())failure.put(key,errors.get(key));
  out.put("complete",complete);out.put("errors",failure);out.put("bytes",get(c).getCacheSpace());
 }catch(Exception ignored){}return out.toString();}
 public static void download(Context c,String id,String url){if(pending.putIfAbsent(id,true)!=null)return;errors.remove(id);executor.execute(()->{try{
  MediaItem item=new MediaItem.Builder().setUri(url).setCustomCacheKey(id).build();new ProgressiveDownloader(item,factory(c)).download(null);
 }catch(Exception e){errors.put(id,"下载失败，请检查网络与存储空间。");}finally{pending.remove(id);}});}
 public static void remove(Context c,String id){try{get(c).removeResource(id);}catch(Exception e){errors.put(id,"缓存移除失败");}}
}
