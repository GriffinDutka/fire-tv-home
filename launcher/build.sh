#!/usr/bin/env bash
# Build Griffin Home without Gradle: aapt2 → javac → d8 → zipalign → apksigner.
# Output: launcher/build/griffin-home.apk
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_SDK_ROOT:-/opt/homebrew/share/android-commandlinetools}"
BT="$SDK/build-tools/34.0.0"
AJAR="$SDK/platforms/android-28/android.jar"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export PATH="$JAVA_HOME/bin:$PATH"

SRC="$HERE/app/src/main"
OUT="$HERE/build"
KS="$HERE/debug.keystore"
VERSION="${VERSION:-$(date +%s)}"

rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"

"$BT/aapt2" compile --dir "$SRC/res" -o "$OUT/res.zip"
"$BT/aapt2" link -I "$AJAR" --manifest "$SRC/AndroidManifest.xml" -A "$SRC/assets" \
  --min-sdk-version 22 --target-sdk-version 28 \
  --version-code "$((VERSION / 60))" --version-name "1.0" \
  --java "$OUT/gen" -o "$OUT/unsigned.apk" "$OUT/res.zip"

javac -source 8 -target 8 -nowarn -Xlint:-options -encoding UTF-8 \
  -classpath "$AJAR" -d "$OUT/classes" \
  $(find "$SRC/java" "$OUT/gen" -name '*.java')

"$BT/d8" --lib "$AJAR" --min-api 22 --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
(cd "$OUT/dex" && zip -q -u "$OUT/unsigned.apk" classes.dex)

"$BT/zipalign" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [[ ! -f "$KS" ]]; then
  keytool -genkeypair -keystore "$KS" -storepass android -keypass android -alias griffin \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Griffin Home" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --out "$OUT/griffin-home.apk" "$OUT/aligned.apk"

echo "Built $OUT/griffin-home.apk"
