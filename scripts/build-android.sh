#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export ANDROID_HOME="${ANDROID_HOME:-/Users/lism/Library/Android/sdk}"
GRADLE_USER_HOME="${GRADLE_USER_HOME:-$PWD/android-build-cache}"
export GRADLE_USER_HOME
praise_gradle="${PRAISE_GRADLE:-/Users/lism/.gradle/wrapper/dists/gradle-8.2.1-all/d8pvvlun5bx6sdtwqhf8y9z4b/gradle-8.2.1/bin/gradle}"
"$praise_gradle" -p android assembleDebug --console=plain
mkdir -p output
cp android/app/build/outputs/apk/debug/app-debug.apk output/赞美诗-1.0.2-debug.apk
