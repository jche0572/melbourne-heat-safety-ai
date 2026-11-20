# Local Expo Web API configuration

The Web map and the location search use different connections:

- Map tiles: Maps JavaScript API, using the existing `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Autocomplete: `GET {EXPO_PUBLIC_API_BASE_URL}/api/places/autocomplete?input=Mel`.
- Selected place coordinates: `GET .../api/places/details?placeId=...`.
- Current-location boundary validation: browser geolocation, then
  `GET .../api/service-area/check?lat=...&lng=...`.

The backend uses its private `GOOGLE_PLACES_API_KEY` for Places API (New) requests.
Do not put this server key into a public Expo environment variable.

## Confirmed local issue

`.env.development.local` previously overrode the working `.env.local` API URL
with `http://localhost:4000`. No backend was listening there. Autocomplete and
boundary checks failed with connection refused, while Google map tiles could still
load independently. This configuration existed before the Mini Map work; the
search/location services and Nearby Cooling screen match `main`.

The override is now commented out, so Expo development inherits `.env.local`.
The existing configured backend returned HTTP 200 for `input=Mel` (five
suggestions) and a Melbourne CBD boundary check, with
`Access-Control-Allow-Origin: *`. No external Google Cloud settings were changed.

Restart Expo after changing environment files; public environment variables are
inlined into the client bundle:

```powershell
Set-Location ./mobile
npx expo start --web --clear
```

Stop the previous Expo process in its terminal first, then reload the browser.
If intentionally using a local backend, uncomment the override only after starting
it in a separate terminal:

```powershell
Set-Location ./server
node index.js
```

The local server needs the project's existing private backend environment settings
and database connectivity. `http://localhost:4000/` should return JSON before Expo
is pointed at it. Native devices need a reachable host address rather than the
device's own `localhost`.

## Current location

Use a secure origin (`https` or `localhost`) and allow location access in browser
site settings if desired. Do not disable City of Melbourne boundary validation:
outside-area coordinates and failed validation are different outcomes. Denying
location access still allows manual search. A boundary API failure produces
“Unable to verify your current location”; this is not proof of permission denial.

## Checks

```powershell
Set-Location ./mobile
node --test tests/nearby-cooling-services.test.cjs tests/mini-map.test.cjs tests/scenario-learning.test.cjs
```

In Web, type **Mel**, select a Melbourne suggestion, select nearby shade/water,
open Cooling Route and check **Minimize → Restore → Minimize → X**. Browser
geolocation depends on the browser and the physical device; automated service
tests cover granted and denied callbacks without using personal coordinates.

Verification after the fix: **57 mobile tests passed, 0 failed**. A fresh local
Expo development session showed five suggestions for **Mel**, loaded a Melbourne
origin and nearby shade, calculated a real **113 m / 2 min** walking route, and
passed Mini Map minimize, restore and close. No browser errors were logged in that
session. The test browser denied geolocation; real granted GPS was not tested.
