# Native floating map bubble

iOS and Android use the existing App-owned route snapshot and MiniMapProvider.
Web screen, launcher and overlay implementations are unchanged.

## Flow

1. In Nearby Cooling, search/use location, select shade or water, and wait for the
   walking route to finish. Choose **Continue to cooling route**.
2. Choose **Open in Google Maps**. The native launcher copies the destination,
   origin, route coordinates, metrics and optional final destination/second leg
   before calling React Native Linking with the existing walking directions URL.
3. Return to SolAdapt. A 54 px green map bubble remains on the right side, including
   while navigating to other screens. Tap it to launch the same saved journey.
4. Use the separate 44 px close button to clear the session without changing pages.

The bubble is an in-app React Native view, with safe-area padding, a reserved bottom
control area, shadows/elevation and pointer-event pass-through around its controls.
It does not create a Google Maps instance. No system overlays, native services,
extra permissions, configuration changes or new dependencies were added.

Launch failures retain the route and display an accessible retry message. Concurrent
launch taps are ignored while Linking is pending. Dismiss never closes Google Maps.
The session remains in memory while App is mounted; app termination/reload clears it.

## Verification

```powershell
Set-Location ./mobile
node --test tests/mini-map.test.cjs tests/nearby-cooling-services.test.cjs tests/scenario-learning.test.cjs
npx expo export --platform web --platform android --platform ios --output-dir .expo/native-bubble-verification --no-minify
npx expo start
```

Use Expo Go on a physical iOS/Android device and scan the QR code, or use the project's
existing development build. Keep the existing backend and native map key configuration;
the external directions URL itself needs no API key. Native Google Maps rendering on
Android still depends on the existing Maps SDK configuration and build environment.

On each physical platform, verify both shade and water selections, opening Maps,
returning to SolAdapt, navigating between screens, repeated bubble taps, dismissing,
and safe-area placement with device navigation controls and landscape orientation.
Check with and without Google Maps installed, and with a failed URL launch. The OS
chooses the installed app or Google Maps website for the universal URL. SolAdapt does
not inspect/control external Maps state; Google calculates its own path from the saved
coordinates rather than accepting SolAdapt's stored polyline.

Automated tests mock platform Linking and native host views. They cover iOS/Android
route handoff, save-before-launch, reopening, failures, rapid taps, safe-area offsets,
single-bubble rendering, dismissal and shared state across screen changes, alongside
the existing Web regression tests. Bundle exports are compatibility checks, not native
APK compilation or physical-device verification.
