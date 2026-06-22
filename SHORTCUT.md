# iMaliya — Automatic SMS capture (works while the phone is locked)

This is the canonical, version-controlled spec for the iOS Shortcut that logs every bank SMS into iMaliya **automatically, with no app open, even on the lock screen.** Rebuild it deterministically from the steps below.

## The key rule for lock-screen operation
The automation completes while locked **only if it never tries to open an app or show a screen that needs unlocking.** So the Shortcut does *one* thing: append the message text to a file in iCloud Drive. No "Open App", no "Show Result", no parsing. iMaliya reads that file when you open it (and de-duplicates, so syncing twice is harmless).

> Why not show the parsed transaction without opening the app? A web app can only draw on screen while it is open — iOS gives it no background. The **logging** is automatic and lossless; **viewing** still happens when you open iMaliya. (If you want an instant on-lock-screen confirmation, add the optional "Show Notification" step below — notifications are allowed while locked.)

## Build it (once)

1. **Shortcuts app → Automation tab → `+` → Create Personal Automation.**
2. Choose **Message** → **Message Contains** and enter trigger words (comma-separated):
   `debited, credited, purchase, Fawri, salary, خصم, شراء, إيداع, راتب`
   (Add your banks' exact words — NBB, BBK, BisB, etc.)
3. Tap **Next**. Add a single action:
   - **Append to File** (search "Append").
   - Text to append: insert the **Shortcut Input** (the message text), then type a space, then insert **Current Date** (format: ISO 8601), and end with a **newline**. The simplest reliable line is just the **Shortcut Input** followed by a blank line.
   - File: tap the file field → **iCloud Drive** → filename `imaliya_bridge.json`. (If it doesn't exist, Shortcuts creates it.)
   - In the action's options, make sure **"Make New Line"** / append mode is on so each SMS is added, not overwritten.
4. *(Optional, recommended for a structured file)* Instead of raw text, append one JSON object per line:
   ```
   {"text":"<Shortcut Input>","ts":"<Current Date, ISO 8601>"}
   ```
   iMaliya reads this NDJSON format directly (one `{...}` per line) and keeps the real timestamp.
5. *(Optional, lock-screen confirmation)* Add **Show Notification** with text like `Logged: <Shortcut Input>`. Notifications display while locked; they don't force an unlock.
6. Tap **Next → Done.** Then open the automation and:
   - **Run Immediately: ON**
   - **Ask Before Running: OFF**
   - **Notify When Run:** your choice.

That's it. From now on, every matching bank SMS is appended to `imaliya_bridge.json` the instant it arrives, silently, locked or not.

## Sync into iMaliya
- **iPhone:** open iMaliya → **More → Automatic capture → Connect bridge file** (pick `imaliya_bridge.json` once), then **Sync now**. iOS Safari can't keep a permanent file handle, so you tap **Sync** when you open the app; nothing is ever lost because logging already happened and imports de-duplicate.
- **Desktop / Android Chrome:** after **Connect bridge file** once, iMaliya re-reads the file **silently on every launch** (File System Access API).
- **Manual / testing:** paste any SMS text into **More → Automatic capture → paste box → Parse**, or use **🧪 Try a sample message**.

## File format accepted by iMaliya
- A JSON array: `[{"text":"...","ts":"..."}, ...]`
- **NDJSON** (recommended for Append): one `{"text":"...","ts":"..."}` per line
- Plain raw SMS blocks separated by blank lines

## Backup the Shortcut
Shortcuts has no version history. After building, **Share → Copy iCloud Link** and keep that link — it both backs up the automation and is the install method for other devices/users. The valuable logic (parsing) lives in `index.html`, so even if the Shortcut is lost, only this thin appender needs rebuilding from this file.
