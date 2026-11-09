param([Parameter(Mandatory=$true)][string]$TestUrl)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $projectRoot
try {
    $env:MOBILE_TEST_URL = $TestUrl
    npm.cmd --prefix mobile ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
    npm.cmd --prefix mobile run sync:test -- android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed' }
    docker build -t nirangnae-android-builder -f mobile/Dockerfile.build mobile
    if ($LASTEXITCODE -ne 0) { throw 'Builder image failed' }
    docker run --rm -v "${projectRoot}:/workspace" -v nirangnae-android-gradle:/root/.gradle -v nirangnae-android-signing:/root/.android nirangnae-android-builder bash gradlew assembleDebug --no-daemon --max-workers=2
    if ($LASTEXITCODE -ne 0) { throw 'APK build failed' }
    New-Item -ItemType Directory -Force artifacts | Out-Null
    Copy-Item mobile/android/app/build/outputs/apk/debug/app-debug.apk artifacts/nirangnae-test.apk
    Get-FileHash artifacts/nirangnae-test.apk -Algorithm SHA256
} finally { Pop-Location }
