package cn.praise.player;
import android.app.*;
import android.content.*;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.*;
import androidx.media3.common.*;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import org.json.*;
import java.util.*;
@UnstableApi
public class PlaybackService extends Service {
 public static volatile PlaybackService instance;
 public static volatile String snapshot="{}";
 private ExoPlayer player;
 private MediaSession session;
 private JSONArray queue=new JSONArray();
 private final Handler handler=new Handler(Looper.getMainLooper());
 private Runnable sleep;
 private boolean foreground=false;
 private String error="";
 private android.graphics.Bitmap cover;
 private String lastMetadata="";
 private static final String CHANNEL="praise_playback";
 private static final int NOTIFICATION=71;
 private final Runnable ticker=new Runnable(){public void run(){publishState();handler.postDelayed(this,400);}};
 @Override public void onCreate(){super.onCreate();instance=this;
  getSystemService(NotificationManager.class).createNotificationChannel(new NotificationChannel(CHANNEL,"音乐播放",NotificationManager.IMPORTANCE_LOW));
  player=new ExoPlayer.Builder(this).setMediaSourceFactory(new DefaultMediaSourceFactory(AudioCache.factory(this))).build();
  player.setAudioAttributes(new androidx.media3.common.AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),true);
  player.setHandleAudioBecomingNoisy(true);player.setWakeMode(C.WAKE_MODE_LOCAL);
  try{android.graphics.BitmapFactory.Options options=new android.graphics.BitmapFactory.Options();options.inSampleSize=4;cover=android.graphics.BitmapFactory.decodeStream(getAssets().open("web/artwork/meadow.webp"),null,options);}catch(Exception ignored){}
  session=new MediaSession(this,"PraisePlayer");session.setCallback(new MediaSession.Callback(){
   @Override public void onPlay(){startForegroundPlayback();player.play();}
   @Override public void onPause(){player.pause();}
   @Override public void onSkipToNext(){next();}
   @Override public void onSkipToPrevious(){previous();}
   @Override public void onSeekTo(long pos){player.seekTo(pos);}
   @Override public void onStop(){player.pause();stopForeground(STOP_FOREGROUND_REMOVE);foreground=false;}
  },handler);session.setActive(true);
  player.addListener(new Player.Listener(){
   @Override public void onEvents(Player p,Player.Events events){publishState();updateNotification();}
   @Override public void onPlayerError(PlaybackException e){error="音频加载失败，请检查网络后重试。";publishState();updateNotification();}
  });handler.post(ticker);
 }
 private JSONObject track(){try{return queue.optJSONObject(player.getCurrentMediaItemIndex());}catch(Exception e){return null;}}
 private PendingIntent action(String cmd,int code){Intent i=new Intent(this,PlaybackService.class).setAction(cmd);return PendingIntent.getService(this,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 private Notification notification(){JSONObject t=track();String title=t==null?"赞美诗":t.optString("title","赞美诗");
  PendingIntent content=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  return new Notification.Builder(this,CHANNEL).setSmallIcon(R.drawable.ic_music).setContentTitle(title).setContentText("赞美诗集").setLargeIcon(cover).setContentIntent(content).setVisibility(Notification.VISIBILITY_PUBLIC).setOnlyAlertOnce(true).setShowWhen(false).setOngoing(player.isPlaying())
   .addAction(new Notification.Action.Builder(R.drawable.ic_previous,"上一首",action("previous",1)).build())
   .addAction(new Notification.Action.Builder(player.isPlaying()?R.drawable.ic_pause:R.drawable.ic_play,player.isPlaying()?"暂停":"播放",action(player.isPlaying()?"pause":"play",2)).build())
   .addAction(new Notification.Action.Builder(R.drawable.ic_next,"下一首",action("next",3)).build())
   .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0,1,2)).build();
 }
 private void startForegroundPlayback(){startForeground(NOTIFICATION,notification());foreground=true;}
 private void updateNotification(){if(foreground)getSystemService(NotificationManager.class).notify(NOTIFICATION,notification());}
 private void publishState(){if(player==null)return;try{JSONObject t=track();long duration=Math.max(0,player.getDuration()==C.TIME_UNSET?0:player.getDuration());long position=Math.max(0,player.getCurrentPosition());JSONObject s=new JSONObject();s.put("trackId",t==null?JSONObject.NULL:t.optString("id"));s.put("time",position/1000.0);s.put("duration",duration/1000.0);s.put("playing",player.isPlaying());s.put("loading",player.getPlaybackState()==Player.STATE_BUFFERING);s.put("error",error);snapshot=s.toString();
  long actions=PlaybackState.ACTION_PLAY|PlaybackState.ACTION_PAUSE|PlaybackState.ACTION_PLAY_PAUSE|PlaybackState.ACTION_SEEK_TO|PlaybackState.ACTION_SKIP_TO_NEXT|PlaybackState.ACTION_SKIP_TO_PREVIOUS|PlaybackState.ACTION_STOP;
  int state=player.isPlaying()?PlaybackState.STATE_PLAYING:player.getPlaybackState()==Player.STATE_BUFFERING?PlaybackState.STATE_BUFFERING:PlaybackState.STATE_PAUSED;
  session.setPlaybackState(new PlaybackState.Builder().setActions(actions).setState(state,position,player.isPlaying()?1f:0f).build());
  if(t!=null&&!(t.optString("id")+duration).equals(lastMetadata)){lastMetadata=t.optString("id")+duration;session.setMetadata(new MediaMetadata.Builder().putString(MediaMetadata.METADATA_KEY_TITLE,t.optString("title")).putString(MediaMetadata.METADATA_KEY_ARTIST,"赞美诗集").putString(MediaMetadata.METADATA_KEY_ALBUM,"赞美诗集").putLong(MediaMetadata.METADATA_KEY_DURATION,duration).putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART,cover).build());}
 }catch(Exception ignored){}}
 public void load(String raw,int index,double position,boolean autoplay){try{queue=new JSONArray(raw);ArrayList<MediaItem> items=new ArrayList<>();for(int i=0;i<queue.length();i++){JSONObject t=queue.getJSONObject(i);items.add(new MediaItem.Builder().setMediaId(t.getString("id")).setUri(t.getString("src")).setCustomCacheKey(t.getString("id")).build());}error="";player.setMediaItems(items,Math.min(index,Math.max(0,items.size()-1)),(long)(position*1000));player.prepare();if(autoplay){startForegroundPlayback();player.play();}publishState();}catch(Exception e){error="播放队列读取失败。";publishState();}}
 public void updateQueue(String raw,int index){boolean playing=player.isPlaying();double position=player.getCurrentPosition()/1000.0;load(raw,index,position,playing);}
 public void next(){error="";if(player.hasNextMediaItem())player.seekToNextMediaItem();else if(player.getMediaItemCount()>0)player.seekTo(0,0);player.prepare();startForegroundPlayback();player.play();}
 public void previous(){error="";if(player.getCurrentPosition()>3000)player.seekTo(0);else if(player.hasPreviousMediaItem())player.seekToPreviousMediaItem();else if(player.getMediaItemCount()>0)player.seekTo(player.getMediaItemCount()-1,0);startForegroundPlayback();player.play();}
 public void setMode(String repeat,boolean shuffle){player.setRepeatMode(repeat.equals("one")?Player.REPEAT_MODE_ONE:repeat.equals("off")?Player.REPEAT_MODE_OFF:Player.REPEAT_MODE_ALL);player.setShuffleModeEnabled(shuffle);}
 public void sleep(double minutes){if(sleep!=null)handler.removeCallbacks(sleep);if(minutes>0){sleep=()->player.pause();handler.postDelayed(sleep,(long)(minutes*60000));}}
 @Override public int onStartCommand(Intent i,int flags,int startId){if(i==null)return START_NOT_STICKY;String command=i.getAction();if(command==null)command="sync";
  switch(command){case "load":if(i.getBooleanExtra("autoplay",true))startForegroundPlayback();load(i.getStringExtra("queue"),i.getIntExtra("index",0),i.getDoubleExtra("position",0),i.getBooleanExtra("autoplay",true));break;
   case "queue":updateQueue(i.getStringExtra("queue"),i.getIntExtra("index",0));break;
   case "play":error="";startForegroundPlayback();if(player.getPlaybackState()==Player.STATE_IDLE)player.prepare();player.play();break;
   case "pause":player.pause();break;case "seek":player.seekTo((long)(i.getDoubleExtra("position",0)*1000));break;
   case "next":next();break;case "previous":previous();break;
   case "volume":player.setVolume((float)i.getDoubleExtra("value",.8));break;
   case "mode":setMode(i.getStringExtra("repeat"),i.getBooleanExtra("shuffle",false));break;
   case "sleep":sleep(i.getDoubleExtra("minutes",0));break;
  }publishState();return START_NOT_STICKY;
 }
 @Override public void onDestroy(){handler.removeCallbacksAndMessages(null);if(player!=null)player.release();if(session!=null)session.release();snapshot="{}";instance=null;super.onDestroy();}
 @Override public IBinder onBind(Intent i){return null;}
}
