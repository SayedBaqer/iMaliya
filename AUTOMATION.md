# iMaliya — Automatic capture, deep dive

Goal: log every bank transaction **automatically, with no app open, even while the phone is locked** — and have it appear with zero fuss when you do open iMaliya.

## The one unavoidable fact
A web app (PWA / WebView) can only draw on screen **while it is open**. iOS gives it no background execution. So "viewing" always means opening the app. Everything below is about making **capture + parsing** fully automatic so that the moment you open iMaliya, today's transactions are simply *there*.

## Options considered

| # | Approach | Parses while locked | Current without opening | Privacy | Notes |
|---|---|---|---|---|---|
| A | Thin Shortcut appends raw SMS → iCloud file; app parses on open | logs only | logged, parsed on open | on-device | simplest; works today |
| B | "Fat" Shortcut parses with *Match Text* regex into a ledger | yes | yes | on-device | fragile, painful to maintain — avoid |
| **C** | **Shortcut → Scriptable "Run Script"** runs real JS headless; host injects on open | **yes** | **yes** | on-device | **recommended** |
| D | Shortcut `Get Contents of URL` → serverless endpoint (E2EE) | yes | yes, any device + push | leaves device | opt-in; enables multi-device |

## Recommended: C — Scriptable capture + WebView host (on-device)

Two scripts ship in [`scriptable/`](scriptable/):

- **`imaliya-capture.js`** — runs from the Shortcut automation. Presents no UI, so it **completes while locked**. Appends the SMS as an NDJSON line to `imaliya_bridge.json` in Scriptable's iCloud Documents, and shows a silent lock-screen notification ("Logged BHD 12.5").
- **`imaliya-host.js`** — the thing you tap to open iMaliya. It loads `index.html`, reads everything `imaliya-capture` logged while locked, **injects it into the page** (`window.__IMALIYA_BRIDGE__`), then truncates the bridge file. iMaliya auto-ingests on boot and de-duplicates. No file picker, no paste.

### Wire it up
1. Save both scripts in **Scriptable** (names: `imaliya-capture`, `iMaliya`). Put `index.html` in Scriptable's iCloud Documents (or set `HTML_URL` in the host to your hosted copy).
2. **Shortcuts → Automation → Personal → "Message Contains"** with your bank keywords (`debited, credited, Fawri, salary, خصم, شراء, إيداع, راتب`).
3. **Run Immediately ON, Ask Before Running OFF.**
4. One action: **Run Script** → `imaliya-capture`, pass the message as input. **No "Open App" action** (that would force an unlock).
5. Add the **`iMaliya`** host script to the Home Screen (Scriptable → Add to Home Screen) for an app icon.

Result: bank SMS arrives → automation fires silently while locked → parsed-ready data is logged + you get a notification → next time you tap the iMaliya icon, it's already in your dashboard.

### Why this is better than parsing inside Shortcuts (B)
The parsing logic lives once, in `index.html` (`parseSMS`). The capture script stays "thin" (just append), so the fragile part never gets duplicated into Shortcuts' clumsy *Match Text* actions. If you ever want capture-time parsing (e.g. to drive a widget), `imaliya-capture` can import the same parser — but it isn't needed for the flow above.

## Fallback: A — standalone Safari PWA (no Scriptable)
If you run iMaliya as a Safari "Add to Home Screen" app instead of via Scriptable:
- Use the thin **Append to File** Shortcut from [SHORTCUT.md](SHORTCUT.md).
- In iMaliya: **More → Automatic capture → Connect bridge file** (pick the file once) → **Sync**. iOS Safari can't keep a permanent file handle, so it's a one-tap Sync per session; desktop/Android Chrome re-sync silently every launch.

## Opt-in: D — cloud relay (multi-device + real push)
If you want transactions on multiple devices and true push notifications (not just on-device):
- Stand up a tiny serverless endpoint (Cloudflare Worker / Supabase Edge Function).
- Shortcut action **Get Contents of URL** → `POST` the SMS (runs while locked). Encrypt client-side for an E2EE posture so the server only stores ciphertext.
- iMaliya pulls (or receives via Web Push) on open / in background where supported.
- Trade-off: data leaves the device — only do this if multi-device is worth more than the strict on-device promise. The app's JSON model is ready for it; ask and I'll add the sync adapter.

## App hooks (for embedders)
- `window.__IMALIYA_BRIDGE__` — set before load; auto-ingested on boot.
- `window.imaliyaIngest(data)` — call on a live app to push new SMS/records; returns `{added,dup}`.
- URL: open with `?sms=<text|json>` or `#sms=<...>` to ingest on launch.
- Bridge formats accepted: JSON array, **NDJSON** (one object per line), raw text blocks, and **pre-parsed records** (`{amount,direction,counterpartyIBAN,...}`) which skip re-parsing.
