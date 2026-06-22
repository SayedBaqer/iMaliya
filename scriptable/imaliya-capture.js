// iMaliya — headless SMS capture for Scriptable
// Triggered by a Shortcut automation ("Message Contains" -> Run Script).
// Presents NO UI, so it completes silently even while the iPhone is LOCKED.
// It appends the bank SMS to a shared bridge file (NDJSON) that iMaliya reads on open.
//
// Setup (once):
//   1. Save this as a Scriptable script named "imaliya-capture".
//   2. Shortcuts -> Automation -> Personal -> "Message Contains" (your bank keywords),
//      Run Immediately ON, Ask Before Running OFF.
//   3. Single action: "Run Script" (Scriptable) -> script: imaliya-capture,
//      pass the message as input ("Shortcut Input" / "Text"). Do NOT add "Open App".
//   4. Done. Every matching SMS is logged, locked or not.

const BRIDGE = "imaliya_bridge.json";       // lives in Scriptable's iCloud Documents
const NOTIFY = true;                          // lock-screen confirmation notification

// --- get the incoming message text from the Shortcut ---
function inputText() {
  if (args.plainTexts && args.plainTexts.length) return args.plainTexts.join("\n");
  const p = args.shortcutParameter;
  if (typeof p === "string") return p;
  if (p && typeof p === "object") return p.text || p.body || p.message || JSON.stringify(p);
  return "";
}

// --- pick a filesystem (iCloud preferred so iMaliya / Files can read it) ---
function fmAndPath() {
  let fm;
  try { fm = FileManager.iCloud(); } catch (e) { fm = FileManager.local(); }
  return { fm, path: fm.joinPath(fm.documentsDirectory(), BRIDGE) };
}

// --- lightweight amount/currency sniff, only for the notification text ---
function quickAmount(t) {
  const m = t.match(/\b(BHD|BD|USD|SAR|AED|KWD|QAR|OMR|EUR)\s*([\d,]+\.?\d*)/i)
         || t.match(/([\d,]+\.\d{2,3})\s*(BHD|BD|USD|SAR|AED|KWD|QAR|OMR|EUR)/i);
  if (!m) return "";
  const cur = (m[1].match(/[A-Z]/i) ? m[1] : m[2]).toUpperCase().replace("BD", "BHD");
  const amt = (m[1].match(/[\d.,]/) ? m[1] : m[2]).replace(/,/g, "");
  return `${cur} ${amt}`;
}

async function main() {
  const text = inputText().trim();
  if (!text) { Script.complete(); return; }

  const { fm, path } = fmAndPath();
  // ensure the iCloud file is local before reading
  try { if (fm.fileExists(path) && !fm.isFileDownloaded(path)) await fm.downloadFileFromiCloud(path); } catch (e) {}

  let prev = "";
  try { if (fm.fileExists(path)) prev = fm.readString(path) || ""; } catch (e) {}

  // one JSON object per line (NDJSON) — iMaliya parses this format directly
  const line = JSON.stringify({ text, ts: new Date().toISOString() });
  const out = prev && !prev.endsWith("\n") ? prev + "\n" + line + "\n" : prev + line + "\n";
  fm.writeString(path, out);

  if (NOTIFY) {
    const n = new Notification();
    n.title = "iMaliya";
    const amt = quickAmount(text);
    n.body = amt ? `Logged ${amt}` : "Transaction logged";
    n.sound = null;            // silent; just a lock-screen confirmation
    try { await n.schedule(); } catch (e) {}
  }
  Script.complete();
}
await main();
