# Cooling Route floating map bubble

Expo Web displays a 54 px circular green map button when Cooling Route is minimized.
The bubble contains only a white icon, with no Google Maps instance or API requests.
A separate 44 px dismiss button sits above it with an 8 px gap. Both controls are
keyboard accessible and show a focus ring. The layer passes events through to the
underlying page outside the controls and reserves space for bottom navigation.

## Architecture

The existing implementation is retained: `App.js` owns one temporary route snapshot
above the navigator; `MiniMapProvider` exposes minimize; `miniMapRoute.js` copies and
validates the route and restores navigation. `MiniMapOverlay.web.js` renders the
bubble. Its native counterpart renders nothing, preserving Android/iOS compatibility.

Minimize saves the cooling destination, origin, walking route, metrics and optional
final destination/second leg before returning to the previous screen. Without a
previous entry, it opens Nearby Cooling. The snapshot persists across navigation.
Restore uses that snapshot without requesting another route; an existing route stack
entry is reused. The bubble hides on the full route screen. Dismiss clears the saved
session without changing pages. A single app-level slot prevents duplicate bubbles.

### External Google Maps session

**Open in Google Maps** saves the complete route snapshot with `mode: googleMaps`
before synchronously opening the existing walking directions URL in a separate
named tab. SolAdapt remains on the same screen. The bubble is immediately active,
so it is visible when returning to SolAdapt, including on Cooling Route itself.
Its accessible label becomes **Reopen cooling route in Google Maps**. It opens the
saved route again if the Maps tab was closed, or focuses the existing launch tab
when the same journey is already open. No Google Maps page content is read or changed.

`googleMapsNavigation.web.js` owns the launch handle, handles blocked/failed launches,
and preserves a retryable session with an accessible error message. The generic
counterpart is a native no-op. The provider exposes the launch action; App keeps the
same single snapshot slot and dismiss handler. Minimize starts an internal session
again; the latest action determines what the single bubble does.

Dismiss clears only SolAdapt's temporary snapshot, leaving the current page and
the external Maps tab untouched. Reload clears the session. Google Maps computes
its own route from origin/destination/waypoint coordinates; the stored SolAdapt
polyline is preserved internally but cannot be forced onto the official website.
Changes made on the Maps website are not tracked. Browser isolation or focus policies
can limit tab reuse; external network failures cannot be inspected cross-origin.

The session is temporary and clears on browser reload. The bubble is not draggable.
Restoring remounts the full map, so the route is retained but its camera/zoom state is
not. The underlying Nearby Cooling page can still render its own existing map.

## Run and verify

From PowerShell:

```powershell
Set-Location ./mobile
node --test tests/mini-map.test.cjs tests/nearby-cooling-services.test.cjs tests/scenario-learning.test.cjs
npx expo start --web
npx expo export --platform web --platform android --platform ios --output-dir .expo/maps-return-verification --no-minify
```

Use the existing environment configuration with a working API base URL and Maps key.
No dependencies, native permissions, native modules or backend changes are required.

External flow in a normal Chrome/Edge browser:

1. Open Cooling Route and click **Open in Google Maps**. Confirm a separate tab
   with walking directions to the cooling stop (via that stop if a final destination exists).
2. Return to SolAdapt: its route screen remains intact and the green bubble is visible.
3. Navigate to Nearby Cooling or Home and click the bubble. Confirm the same Maps
   launch tab is focused; close that tab and repeat to confirm a new launch.
4. Dismiss the bubble: confirm the current SolAdapt page does not change.
5. Block popups for the local origin and retry from Cooling Route. Confirm a visible
   error and retryable session; allow popups and click the bubble again.
6. Check the internal Minimize/Restore flow independently using the steps below.

1. Search a Melbourne location in Nearby Cooling, select shade/water and open Cooling Route.
2. Optionally choose a final destination and wait for its route leg.
3. Minimize: verify return to the previous page, one circular bubble and no rectangular preview.
4. Navigate to Home: verify the bubble remains and underlying controls work.
5. Restore by click or keyboard Enter/Space: verify destination, walking route and metrics.
6. Minimize again; dismiss: verify the bubble disappears without changing pages.
7. Repeat at 375 x 667 and a short viewport; check control spacing and keyboard focus.

## Automated verification

61 mobile tests pass, including route/destination/second-leg preservation, restore
without fetching, screen persistence, single-session behavior, independent dismissal,
54 px circular geometry, accessible controls, focus styling and no map in the bubble.
External-session tests cover URL coordinates/waypoint/walking mode, save-before-open,
same-tab reuse, closed-tab reopening, blocked/throwing launches, retryable snapshots,
external bubble visibility on Cooling Route, dismissal without navigation and the
full screen's shared launch integration.
Native APK/device testing is separate from Expo bundle compatibility checks.

Web, Android and iOS exports passed, including native Hermes bytecode. Browser
testing used a real Melbourne-to-shade walking route (113 m / 2 min): minimize,
persistence on Home, pointer/Enter restore, repeat minimize and Space dismissal
all passed. At 375 x 667, the bubble measured 54 x 54 px and remained inside the
right edge; no rectangular preview appeared. The browser reported no console
errors. Optional second-leg preservation is covered by automated tests rather
than this browser session. No native device/APK tests were performed.

The server suite still has the previously observed 14 event/recommendation failures
(23 passed). Its source and tests were not changed by the bubble implementation.

For the external-session change, all 61 mobile tests and Web/Android/iOS exports
passed. Browser UI checks confirmed SolAdapt remained on Cooling Route after launch,
one external bubble persisted through Nearby Cooling and Home, its click left
SolAdapt navigation unchanged, and keyboard dismissal removed it while staying
on Home. The mobile-sized layout was inspected; no console errors were reported.
The in-app browser did not expose the external Google Maps tab to automation, so
actual official route-page rendering and tab reuse still need the normal-browser
checks above. Popup-blocker failure and tab reuse were verified with mocked browser
launch handles in automated tests, not by changing browser security settings.
