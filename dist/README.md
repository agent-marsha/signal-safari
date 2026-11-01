# Signal Safari — EMG Web Lab (Grade 6, Mission 6.1)

A **very simple EMG app** built from the Signal Safari lesson plan. Students connect an
**OpenBCI Ganglion** over **Web Bluetooth**, watch their own live muscle signal, play
**"Wake the Bar"**, and record trials that feed the lesson's math (dot plot, mean/median/mode, range).

**Live:** https://lustrous-melomakarona-59e342.netlify.app

## What it does
- **Connect** to a Ganglion (`Ganglion-*`, service `0xfe84`) using the standard Web Bluetooth
  **`ganglion-ble`** client, simplified to one channel.
- **Live signal**: rectified + smoothed EMG envelope, drawn as a scrolling graph (auto-ranged to the
  recent signal, so it works regardless of the device's units).
- **Wake the Bar**: relax → the bar sleeps; squeeze → it climbs into a 60–80 target zone. Score, time, stars.
- **Number Crunch**: record 2-second trials, capture each peak, and auto-compute **mean / median / mode /
  range** with a **dot plot** (Grade 6 math standards MA19.6.22 / 23 / 24).
- **Practice (mock) data**: a no-hardware mode so any classroom can run the whole lesson — the offline
  fallback for schools without a sensor (or on Safari/iOS, where Web Bluetooth doesn't exist).

## Run locally
```bash
npm install                     # ganglion-ble + esbuild
npm run build                   # bundles vendor/ganglion.js from ganglion-ble
python3 -m http.server 8000     # open http://localhost:8000  (Web Bluetooth needs https or localhost)
```

## Files
| File | Role |
|---|---|
| `index.html` | UI (playful styling — teal/yellow/coral/sky, "Milo" mascot) |
| `app.js` | EMG pipeline, game, trials, stats, dot plot, practice mode |
| `src/vendor.js` → `vendor/ganglion.js` | esbuild bundle of `ganglion-ble` (MIT) |
| `dist/` | the deployed static bundle (index.html + app.js + vendor) |

## Notes
- Web Bluetooth requires **Chrome/Edge + HTTPS** (not Safari/iOS). Practice mode covers everything else.
- Uses the Ganglion's **channel 0** for now (the board has 4).
- Requires `sample.channelData` from `ganglion-ble` v1.0.0 (its README's `data` field is stale).
- Credits: built with the `ganglion-ble` client (MIT). Not for medical use.
