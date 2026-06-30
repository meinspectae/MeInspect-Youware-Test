# MeInspect - Android APK Build Instructions

## Prerequisites
- Android Studio installed
- Java JDK 17+ installed
- ANDROID_HOME environment variable set

## Build Steps

### Option 1: Using Android Studio (Recommended)
1. Open Android Studio
2. Click "Open an Existing Project"
3. Navigate to the `android` folder in this project
4. Wait for Gradle sync to complete
5. Click Build → Build Bundle(s) / APK(s) → Build APK(s)
6. APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option 2: Using Command Line
```bash
cd android
./gradlew assembleDebug
```
APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option 3: Release APK (for testing without Play Store)
```bash
cd android
./gradlew assembleRelease
```
Note: Release APK needs signing. For testing, use debug APK.

## Install on Android Device
1. Enable "Install from Unknown Sources" in Android Settings → Security
2. Transfer the APK to your phone
3. Open the APK file and tap Install

## Project Structure
```
android/
├── app/
│   ├── src/main/
│   │   ├── assets/public/    ← Your web app files
│   │   ├── java/             ← Native Android code
│   │   └── res/              ← Android resources
│   └── build.gradle
├── build.gradle
└── settings.gradle
```

## Updating the App
After making changes to the web app:
```bash
npm run build
npx cap sync android
```
Then rebuild the APK in Android Studio.
