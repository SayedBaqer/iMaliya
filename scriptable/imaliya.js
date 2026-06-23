// ============================================================================
// iMaliya — ONE Scriptable script, two jobs:
//   • Run from an Automation with an SMS  -> CAPTURE (silent, works while LOCKED)
//   • Run from the Home Screen (no input) -> VIEWER  (opens the app, auto-imports)
//
// This is the reliable way to auto-log bank SMS on iPhone: a web page can't read
// the inbox or run in the background, but Scriptable can — from a locked-screen
// automation — and it hands the data to the app on open. No file picker, no URL.
//
// SETUP (once):
//   1. Install Scriptable (App Store). Paste this as a script named "iMaliya".
//   2. Make a Home-Screen icon (Scriptable can't add one itself — use Shortcuts):
//      Shortcuts -> + New Shortcut -> action "Run Script" (Scriptable) -> choose iMaliya
//      -> name it iMaliya -> share icon -> "Add to Home Screen". Open iMaliya from it.
//      (Or just tap this script inside Scriptable to open the app.)
//   3. Shortcuts -> Automation -> New -> Personal Automation -> "Message Contains"
//      -> your bank words (debited, credited, Fawri, salary, خصم, شراء, إيداع, راتب).
//      Run Immediately ON, Ask Before Running OFF.
//      One action: "Run Script" -> iMaliya, pass the message as input.
//      DO NOT add "Open App" (that forces an unlock).
//   Done. Bank SMS are captured automatically (locked too); open the icon to see them.
// ============================================================================

const APP_URL = "https://sayedbaqer.github.io/iMaliya/"; // the hosted app
const INBOX   = "imaliya_inbox.json";   // new SMS captured while away (NDJSON)
const STATE   = "imaliya_state.json";   // durable full app data (the source of truth)

function fm(){ try { return FileManager.iCloud(); } catch(e) { return FileManager.local(); } }
function path(f,name){ return f.joinPath(f.documentsDirectory(), name); }

async function read(f,name){
  const p = path(f,name);
  try{
    if(!f.fileExists(p)) return "";
    if(!f.isFileDownloaded(p)) await f.downloadFileFromiCloud(p);
    return f.readString(p) || "";
  }catch(e){ return ""; }
}

function smsInput(){
  if(args.plainTexts && args.plainTexts.length) return args.plainTexts.join("\n");
  const p = args.shortcutParameter;
  if(typeof p === "string") return p;
  if(p && typeof p === "object") return p.text || p.body || p.message || "";
  return "";
}

// ---- CAPTURE MODE (from the automation) ----
async function capture(text){
  const f = fm();
  const prev = await read(f, INBOX);
  const line = JSON.stringify({ text, ts: new Date().toISOString() });
  f.writeString(path(f,INBOX), (prev && !prev.endsWith("\n") ? prev + "\n" : prev) + line + "\n");
  try { const n = new Notification(); n.title = "iMaliya"; n.body = "Transaction logged"; await n.schedule(); } catch(e){}
  Script.complete();
}

// ---- VIEWER MODE (from the Home Screen icon) ----
async function viewer(){
  const f = fm();
  const state = await read(f, STATE);
  const inbox = await read(f, INBOX);

  const wv = new WebView();
  await wv.loadURL(APP_URL);                 // resolves after the page has loaded + booted

  // 1) restore the durable state so nothing is lost between sessions
  if(state && state.trim()){
    try { await wv.evaluateJavaScript("window.imaliyaRestore && window.imaliyaRestore(" + JSON.stringify(state) + ")", true); } catch(e){}
  }
  // 2) ingest anything captured while away (the app de-duplicates)
  if(inbox && inbox.trim()){
    try { await wv.evaluateJavaScript("window.imaliyaIngest && window.imaliyaIngest(" + JSON.stringify(inbox) + ")", true); } catch(e){}
    try { f.writeString(path(f,INBOX), ""); } catch(e){}   // inbox consumed
  }

  await wv.present(true);                     // user views / edits; returns on close

  // 3) save the full state back so edits persist
  try {
    const out = await wv.evaluateJavaScript("window.imaliyaExport ? window.imaliyaExport() : ''");
    if(out && out.trim()) f.writeString(path(f,STATE), out);
  } catch(e){}
  Script.complete();
}

const input = smsInput().trim();
if(input) { await capture(input); } else { await viewer(); }
