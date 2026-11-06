#!/bin/bash
set -euo pipefail
# Keep this volume private and back it up separately from source control.
umask 077
mkdir -p /signing
if [ ! -f /signing/release.p12 ]; then
  if [ ! -f /signing/password ]; then
    head -c 48 /dev/urandom | base64 > /signing/password
  fi
  keytool -genkeypair -keystore /signing/release.p12 -storetype PKCS12 -storepass:file /signing/password -alias nirangnae -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Nirangnae, OU=Application, O=Nirangnae' >/dev/null 2>&1
fi
bash gradlew assembleRelease --no-daemon --max-workers=2
mkdir -p /workspace/artifacts
TOOLS=/opt/android-sdk/build-tools/36.0.0
"$TOOLS/zipalign" -f -p 4 app/build/outputs/apk/release/app-release-unsigned.apk /workspace/artifacts/nirangnae-aligned.apk
"$TOOLS/apksigner" sign --ks /signing/release.p12 --ks-key-alias nirangnae --ks-pass file:/signing/password --out /workspace/artifacts/nirangnae-1.0.1.apk /workspace/artifacts/nirangnae-aligned.apk
"$TOOLS/apksigner" verify --verbose --print-certs /workspace/artifacts/nirangnae-1.0.1.apk
"$TOOLS/aapt" dump badging /workspace/artifacts/nirangnae-1.0.1.apk
