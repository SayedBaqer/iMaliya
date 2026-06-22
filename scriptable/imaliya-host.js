// iMaliya — Scriptable WebView host
// Loads the iMaliya app and injects every SMS captured (while locked) by
// "imaliya-capture", so the data appears automatically on open — no file picker.
//
// Setup (once):
//   1. Save as a Scriptable script named "iMaliya" (this is what you tap to open the app).
//   2. Put index.html next to your scripts in Scriptable's iCloud Documents, OR set HTML_URL
//      to your hosted copy (e.g. GitHub Pages). Local file is preferred for full offline use.
//   3. Add it to the Home Screen via Scriptable's "Add to Home Screen" for an app-like icon.

const BRIDGE = "imaliya_bridge.json";
const HTML_FILE = "index.html";                                   // local copy in Scriptable docs
const HTML_URL  = "https://sayedbaqer.github.io/iMaliya/";         // fallback if no local file

function fm() { try { return FileManager.iCloud(); } catch (e) { return FileManager.local(); } }

async function readIfPresent(f, name) {
  const p = f.joinPath(f.documentsDirectory(), name);
  try {
    if (!f.fileExists(p)) return null;
    if (!f.isFileDownloaded(p)) await f.downloadFileFromiCloud(p);
    return f.readString(p);
  } catch (e) { return null; }
}

async function main() {
  const f = fm();

  // 1) load the app HTML (local first, then remote)
  let html = await readIfPresent(f, HTML_FILE);
  if (!html) {
    const req = new Request(HTML_URL);
    try { html = await req.loadString(); } catch (e) { html = "<h2>iMaliya not found.</h2><p>Add index.html to Scriptable Documents or set HTML_URL.</p>"; }
  }

  // 2) read everything captured while the phone was locked / app was closed
  const bridge = await readIfPresent(f, BRIDGE);

  // 3) inject the captured data so iMaliya auto-ingests it on boot (dedups internally)
  if (bridge && bridge.trim()) {
    const inject = `<script>window.__IMALIYA_BRIDGE__=${JSON.stringify(bridge)};</script>`;
    html = html.includes("</head>") ? html.replace("</head>", inject + "</head>") : inject + html;
  }

  // 4) present the WebView
  const wv = new WebView();
  await wv.loadHTML(html, HTML_URL);   // base URL lets the manifest/CDN scripts resolve
  await wv.present(true);              // fullscreen

  // 5) once imported, truncate the bridge so it stays small (import is idempotent anyway)
  if (bridge && bridge.trim()) {
    try { f.writeString(f.joinPath(f.documentsDirectory(), BRIDGE), ""); } catch (e) {}
  }
  Script.complete();
}
await main();
