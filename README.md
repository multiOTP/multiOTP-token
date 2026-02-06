# multiOTP token

multiOTP token is a Vue.js/Ionic/Capacitor open source OTP generator app, with QR provisioning and push capabilites, for Android and iOS, provided as is by SysCo systemes de communication sa.
* Android app is available on Google Play here: https://play.google.com/store/apps/details?id=com.multiotp.token
* iOS app is available on the Apple App Store here: https://itunes.apple.com/app/multiotp-token/id6755290930
<br />
Push notification can be sent by multiOTP open source using the multiOTP gateway service, an open source gateway available here: https://github.com/multiOTP/multiOTP-gateway-service

(c) 2025-2026 SysCo systemes de communication sa  
https://www.multiotp.net/

Current build: 1.17.0 (2026-02-05)

# Notification services

## Google services (for Android notifications)
Put Google services configuration file (google-services.json) here : `/android/app/`

## Apple services (for iOS notifications)
Configure your Apple developer account and your Xcode in order to use the Apple Push Notification service (APNs)

# Build your app

## For Android
* ionic build
* ionic cap copy
* ionic cap sync
* ionic cap open android

## For iOS
* ionic build --prod
* ionic cap copy
* ionic cap sync ios
* ionic cap open ios
