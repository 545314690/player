package cn.praise.player;
import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.webkit.*;
import android.view.*;
import java.io.*;
import java.util.*;
import org.json.*;
import androidx.media3.common.util.UnstableApi;
@UnstableApi
public class MainActivity extends Activity {
 private WebView web;
 private ValueCallback<Uri[]> fileCallback;
 private String backup;
 private static final String ORIGIN="https://appassets.androidplatform.net/";
 @Override public void onCreate(Bundle b){super.onCreate(b);web=new WebView(this);setContentView(web);
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setMediaPlaybackRequiresUserGesture(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setBackgroundColor(Color.rgb(9,9,9));web.addJavascriptInterface(new Bridge(),"PraiseAndroid");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){if(r.getUrl().toString().startsWith(ORIGIN))return false;if(r.isForMainFrame()&&"https".equals(r.getUrl().getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,r.getUrl()));}catch(Exception ignored){}}return true;}
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){if(!r.getUrl().toString().startsWith(ORIGIN))return null;
    String path=r.getUrl().getPath();if(path==null||path.equals("/"))path="/index.html";
    if(path.contains(".."))return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",Map.of(),new ByteArrayInputStream(new byte[0]));
    try{String mime=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".json")||path.endsWith(".webmanifest")?"application/json":path.endsWith(".webp")?"image/webp":path.endsWith(".png")?"image/png":path.endsWith(".svg")?"image/svg+xml":"text/html";
     Map<String,String> headers=new HashMap<>();headers.put("Access-Control-Allow-Origin",ORIGIN.substring(0,ORIGIN.length()-1));headers.put("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https:; media-src https: blob:; frame-src 'none'; object-src 'none'");
     return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,getAssets().open("web"+path));
    }catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Map.of(),new ByteArrayInputStream(new byte[0]));}
   }
  });
  web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView w,ValueCallback<Uri[]> callback,FileChooserParams params){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE);try{startActivityForResult(i,81);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;}return true;}});
  web.loadUrl(ORIGIN);
 }
 private Intent intent(String action){return new Intent(this,PlaybackService.class).setAction(action);}
 private void send(Intent i,boolean foreground){runOnUiThread(()->{if(foreground)startForegroundService(i);else startService(i);});}
 private class Bridge {
  @JavascriptInterface public String getState(){return PlaybackService.snapshot;}
  @JavascriptInterface public void loadQueue(String queue,int index,double position,boolean play){send(intent("load").putExtra("queue",queue).putExtra("index",index).putExtra("position",position).putExtra("autoplay",play),play);}
  @JavascriptInterface public void updateQueue(String queue,int index,String nextId){send(intent("queue").putExtra("queue",queue).putExtra("index",index).putExtra("nextId",nextId),false);}
  @JavascriptInterface public void play(){send(intent("play"),true);}
  @JavascriptInterface public void pause(){send(intent("pause"),false);}
  @JavascriptInterface public void next(){send(intent("next"),true);}
  @JavascriptInterface public void previous(){send(intent("previous"),true);}
  @JavascriptInterface public void seek(double seconds){send(intent("seek").putExtra("position",seconds),false);}
  @JavascriptInterface public void setLyrics(String id,String lines,double offset,String revision,boolean custom){send(intent("lyrics").putExtra("id",id).putExtra("lines",lines).putExtra("offset",offset).putExtra("revision",revision).putExtra("custom",custom),false);}
  @JavascriptInterface public void setVolume(double volume){send(intent("volume").putExtra("value",volume),false);}
  @JavascriptInterface public void setMode(String repeat,boolean shuffle){send(intent("mode").putExtra("repeat",repeat).putExtra("shuffle",shuffle),false);}
  @JavascriptInterface public void setSleep(double minutes){send(intent("sleep").putExtra("minutes",minutes),false);}
  @JavascriptInterface public String getDownloads(){return AudioCache.status(MainActivity.this);}
  @JavascriptInterface public void download(String id,String url){if(id.matches("s[a-f0-9]{12}")&&(url.startsWith("https://zm.ysaw.top/player/assets/media/")||url.startsWith("https://zm.ysaw.top/songs/assets/media/")||url.startsWith("https://raw.githubusercontent.com/545314690/player/")))AudioCache.download(MainActivity.this,id,url);}
  @JavascriptInterface public void removeDownload(String id){if(id.matches("s[a-f0-9]{12}"))AudioCache.remove(MainActivity.this,id);}
  @JavascriptInterface public void setTheme(String theme){runOnUiThread(()->{boolean dark=theme.equals("black");getWindow().setStatusBarColor(dark?Color.rgb(9,9,9):Color.WHITE);getWindow().setNavigationBarColor(dark?Color.rgb(9,9,9):Color.WHITE);web.setBackgroundColor(dark?Color.rgb(9,9,9):Color.WHITE);web.setSystemUiVisibility(dark?0:View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);});}
  @JavascriptInterface public void exportBackup(String text){backup=text;runOnUiThread(()->{Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"赞美诗备份.json");startActivityForResult(i,82);});}
 }
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==81&&fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileCallback=null;}if(request==82&&result==RESULT_OK&&data!=null&&backup!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(backup.getBytes(java.nio.charset.StandardCharsets.UTF_8));}catch(Exception e){web.evaluateJavascript("window.dispatchEvent(new CustomEvent('praise-error',{detail:'备份保存失败，请重试。'}))",null);}backup=null;}}
 @Override public void onBackPressed(){web.evaluateJavascript("window.praiseHandleBack?window.praiseHandleBack():false",result->{if(!"true".equals(result))finish();});}
 @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);if(web!=null){web.removeJavascriptInterface("PraiseAndroid");web.destroy();}super.onDestroy();}
}
