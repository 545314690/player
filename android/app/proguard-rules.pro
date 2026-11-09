# JavaScript calls this bridge by method name, so keep its exposed methods.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
