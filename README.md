# iMaliya — Personal Finance PWA

A privacy-first, **offline-capable** personal finance app for iPhone, built as a single self-contained `index.html` (the house style from the research study). No build step, no server, no account. All data lives **on-device** in IndexedDB.

Open `index.html` in Safari → **Share → Add to Home Screen** to install as a PWA.

## What's implemented (mapped to the study)

| Study § | Feature | Where |
|---|---|---|
| §3 | One normalizer + dedup (hash of amount+date+counterparty+account) | `ingest()` |
| §3-A | SMS adapter (amount, currency, direction, IBAN, card tail, balance, counterparty) | `parseSMS()`, `ingestSMSBatch()` |
| §3-B | Statement import CSV/XLSX, auto-detect Date/Amount/Desc/Debit/Credit, assign-to-account | `readFile()`, `importRows()`, `autoDetectColumns()` |
| §3-C | Manual quick-add + Apple Pay shape | Add sheet (FAB) |
| §4 | IBAN resolver — full exact + masked prefix+suffix with confidence (1.0 / 0.9 / 0.7) | `matchIBAN()` |
| §4.2 | New-IBAN alert → "Needs review" tray → link flow → learned rule | unlinked tray on Home, `openLinkSheet()`, `reapplyDirectory()` |
| §4.3 | Counterparty directory (own / merchant / person / employer / utility / lender) | `S.directory`, Accounts view |
| §5 | Layered categorization: directory-IBAN → rules → keyword heuristics; recurring detector | `applyRules()`, `detectRecurring()` |
| §5 | 3-level category hierarchy with Arabic names; internal transfers excluded from spend | `DEFAULT_CATS`, `sumSpend()` |
| §6 | Safe-to-spend, cashflow, category donut, trend (stacked area), calendar heatmap, account & counterparty views; day→year grains | Insights view |
| §6 | Multi-currency, CSV/JSON export | `money()`, `exportCSV()`, `exportJSON()` |
| §7 | Loans: principal/APR/term/installment, lender-IBAN auto-match, payoff projection | `openLoanSheet()` |
| §8 | Dark/light, RTL + Arabic, biometric/PIN lock, glanceable hierarchy | theme + i18n + lock screen |
| §9 | IndexedDB storage, service worker for offline shell | `DB`, boot SW |
| §10 | On-device by default, raw SMS stays local, masked IBANs, full data ownership | throughout |

## Automatic capture — works while the phone is locked

See **[SHORTCUT.md](SHORTCUT.md)** for the full build. In short: an iOS personal automation (`Message Contains` → Run Immediately) appends every bank SMS to `imaliya_bridge.json` in iCloud the instant it arrives — **no app open, no unlock needed**, because the only action is a file append. iMaliya reads that file on open (silently re-syncing each launch on desktop/Android; one-tap **Sync** on iPhone, since iOS Safari can't keep a permanent file handle). Imports de-duplicate, so syncing repeatedly is safe. A web app can't render while closed, so *logging* is automatic but *viewing* happens when you open the app; add an optional "Show Notification" step for an instant on-lock-screen confirmation.

## iOS Shortcut bridge (§2) — canonical spec, keep in repo

iOS blocks third-party SMS-inbox access, so capture goes through a **thin Shortcut** that hands raw text to iMaliya. Rebuild it deterministically from this spec:

**Personal Automation — "Message Contains"**
1. Settings: trigger on incoming message containing any of: `debited`, `credited`, `Fawri`, `purchase`, `salary`, `خصم`, `شراء`, `إيداع`, `راتب`. Set **Run Immediately** (no confirmation).
2. Action: **Append to File** — append a JSON line `{ "text": <Shortcut Input>, "ts": <Current Date> }` to `imaliya_bridge.json` in iCloud Drive.
3. Keep the Shortcut **thin** — it only forwards text. All parsing happens in `parseSMS()` inside the app (version-controlled, easy to rebuild).

**iOS 17+ "Transaction" automation** (Apple Pay): fires on a Wallet tap with card/merchant/amount — feed the same JSON bridge as a complementary channel.

**Ingesting:** paste the bridge file contents (or any raw SMS) into **More → SMS inbox**. The parser accepts a JSON array, a single JSON object, or plain text separated by blank lines, and dedups automatically.

**Backup the Shortcut** with `Copy iCloud Link` — that link doubles as the install method for other users.

## Notes / known limits
- System **push notifications** are not readable by Shortcuts; banks that only push (no SMS, no Apple Pay) can only be captured via statement import — by design.
- Chart.js and SheetJS load from CDN on first run, then the service worker caches them for offline use. Service workers require `https://` or `localhost` (not `file://`); the app still works fully without the SW, just without offline shell caching.
- Scanned-PDF (vision/OCR) and cloud-AI fallback categorization (§3 Path 3, §5 layer 4) are intentionally left as future "Private Mode"-gated additions; the deterministic paths are complete.
