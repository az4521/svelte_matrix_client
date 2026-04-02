# Android Build + Push Notifications Setup

## 1. Create a Firebase Project

1. Go to https://console.firebase.google.com/
2. Create a new project (or use an existing one)
3. Add an Android app with package name `moe.crafty.matrix`
4. Download `google-services.json` and place it at:
   `android/app/google-services.json`

## 2. Deploy the Push Gateway

The push gateway bridges your homeserver → FCM.

```bash
cd push-gateway
npm install
```

From the Firebase console:

- Project Settings → Service Accounts → Generate new private key
- Save the downloaded JSON as `push-gateway/service-account.json`

Run the gateway (requires a public HTTPS URL — use a VPS, Railway, Render, etc.):

```bash
PORT=3000 node server.js
```

## 3. Configure the App

Edit `src/lib/push.ts` and set `PUSH_GATEWAY_URL` to your gateway's public URL:

```ts
const PUSH_GATEWAY_URL =
    "https://your-gateway.example.com/_matrix/push/v1/notify";
```

## 4. Build and Sync

```bash
npm run build
npx cap sync android
```

## 5. Open in Android Studio

```bash
npx cap open android
```

Then build/run from Android Studio (Run → Run 'app').

## How it works

```
App (FCM token) → registers pusher with homeserver
Homeserver → POST /_matrix/push/v1/notify → push-gateway
push-gateway → FCM → Android device
```

When the app is in the foreground, `src/lib/push.ts` handles the notification.
When in the background, FCM delivers it directly and Android shows it.
