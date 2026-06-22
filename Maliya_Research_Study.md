# Maliya — Personal Finance PWA: Research & Design Study

*Prepared June 2026 · Context: iPhone-first PWA, Bahrain/GCC banks, SMS + statement ingestion, IBAN-based categorization, offline/on-device.*

---

## 0. What we are building (one paragraph)

A privacy-first, **offline-capable personal finance PWA** for iPhone that ingests transactions automatically from **bank SMS** (via iOS Shortcuts) and from **imported statements** (PDF / Excel / CSV), resolves each transaction to a **specific account and counterparty via its IBAN**, learns **categories from the IBAN/merchant** it was paid to, **alerts the user when a new/unknown IBAN appears** so they can link it, and presents **rich trends and statistics** (daily → yearly), plus **loans, income, and spend** tracking. The goal is to match the best apps on insight and design, and beat them on **automation, regional fit (GCC/IBAN/Arabic), and data ownership**.

---

## 1. Competitive landscape

### 1.1 Global leaders (what to learn from, not copy)

These rely on **Plaid/MX/Finicity bank-sync**, which is largely unavailable in Bahrain — so their *sync model* is irrelevant to us, but their *insight and UX models* are the bar to beat.

| App | Core idea | What to steal | Weakness we can beat |
|---|---|---|---|
| **Monarch Money** | Holistic net-worth + budgeting, collaboration, AI assistant, weekly recaps | Clean dashboard that isn't crowded despite many features; "ask your finances" AI; bill reminders | Subscription-only, no free tier, US-bank-centric |
| **YNAB** | Zero-based "give every dollar a job" | Strong budgeting *philosophy* and goal tracking | Steep learning curve; expensive; no free tier |
| **Quicken Simplifi** | Real-time "spending plan" that adjusts as you spend; deep custom categories (3-level nesting) | **Category hierarchy** (main → sub → sub), unlimited custom reports, projected cash flow | US-institution-bound |
| **Origin** | "Financial command center" — budgeting tied to investing + AI scenario modeling | Integration narrative; AI that *reasons across* data instead of just displaying | Overkill for a personal tracker |
| **Rocket Money** | Finds & cancels subscriptions | **Subscription/recurring detection** is a high-value feature | Narrow scope |
| **PocketGuard** | "How much can I safely spend?" — the *Leftover* number | One glanceable number that answers the daily question | Paywalled, shallow analytics |
| **Empower** | Free net-worth + investment dashboard | Free wealth tracking, debt-paydown, emergency-fund trackers | Investment-skewed |
| **Expensify / Money Manager** | Receipt scanning + manual entry | OCR receipt capture; manual entry that *makes you think* | Business-skewed / manual-heavy |

**Takeaways for Maliya:** glanceable "safe-to-spend" number (PocketGuard), 3-level category nesting + unlimited custom reports (Simplifi), recurring/subscription detection (Rocket Money), an AI "ask your money" layer (Monarch/Origin), and collaboration/sharing (Monarch).

### 1.2 SMS-parsing specialists (most relevant to us)

This is the category Maliya actually competes in — apps that reconstruct your finances from bank SMS instead of bank APIs. Popular in India, Sri Lanka, MENA, Africa: anywhere banks text every transaction.

- **FinArt** — Reads **both SMS and bank-app notifications**, AI categorization, subscription manager, family sync, balance tracking. Notably launched on **iOS in 2026 using *notification* reading** (since iOS blocks SMS-inbox access). Privacy "Private Mode" keeps SMS text on-device. *This is our closest analog and proof the model works on iPhone.*
- **Walnut / Axio** — Pioneer of SMS-built finance (India). Reads 40+ banks, auto-categorizes, bill reminders, split. Drifted into lending (loans push) — a cautionary tale about product focus.
- **Moneyview** — Same SMS model, also drifted to lending; UI increasingly promotes loan products.
- **PennyWise AI** — **100% on-device, no cloud, no account.** Turns bank SMS into a searchable money timeline with on-device AI. Has Smart Rules (AND/OR), loans, grouped transactions, subscriptions, income autopay, account merge. Android-only but the **feature set is an excellent template** and aligns exactly with our privacy stance.
- **Spendee / Money Lover** — Multi-currency, manual + SMS, good analytics.
- **Finny** — Offline-first, AI input, cheap Pro tier; publishes good guides on the Shortcuts approach.

**Key industry caveat (design-defining):** bank SMS often lacks a clean merchant. "debited at POS TERMINAL 4523" gives the parser nothing — so many transactions land in generic categories and need correction. **This is exactly why our IBAN-based mapping matters: the IBAN/counterparty is far more stable and machine-readable than a POS merchant string.**

### 1.3 The Gulf / Bahrain reality

- Serious "account aggregation" in the GCC is done by **regulated open-banking players** — **Tarabut Gateway** (founded Bahrain), **Spare** (CBB-licensed AISP/PISP), **Mod5r** (Saudi sandbox), **BwaTech**. These need **central-bank licensing and bank API partnerships** — not viable for an indie/personal PWA.
- Bank apps themselves (Gulf Bank, BisB, meem, NBB, BBK) offer in-app pie-chart spend analysis, but each is a silo and none unify accounts across banks.
- **Conclusion:** the **SMS + statement-import** path isn't a compromise — for an indie GCC app it's the *only* practical way to unify multiple banks without licensing. Maliya's edge is being the **cross-bank, IBAN-aware, Arabic-capable** layer none of the bank apps provide.

---

## 2. The iOS reality — how data actually gets in (critical)

iPhone is the hard constraint. Plan the architecture around these facts:

1. **Third-party apps cannot read the SMS inbox on iOS.** This is why every "SMS expense tracker" is Android-first. FinArt works around it by reading *notifications*; the cleaner route for us is **Shortcuts automation**.
2. **Shortcuts "Message Contains" trigger** is the supported SMS path. A *personal automation* fires when an incoming message contains a keyword (e.g. `debited`, `Fawri`, `purchase`, Arabic `خصم`/`شراء`). Set it to **Run Immediately** (no confirmation tap). The shortcut receives the message text, which we parse. *This is the channel Maliya already uses and should harden.*
3. **iOS 17+ "Transaction" automation** (`Receive Transaction As Input`) fires on an **Apple Pay / Wallet** tap and hands you **card, merchant, and amount** directly — no SMS parsing needed. Add this as a **second, complementary channel** for Apple Pay spend.
4. **System push notifications are NOT readable by Shortcuts** — so if a bank only pushes (no SMS, no Apple Pay), that transaction can only be captured via statement import. Document this gap for users.
5. **Hosting the PWA:** Scriptable-hosted WebView (your current approach) or a standalone PWA added to the Home Screen. Shortcuts can write parsed data into a shared file (iCloud/On My iPhone JSON) that the WebView reads — the **Note/JSON bridge** pattern.

**Shortcuts backup/recovery (you lost one):** Shortcuts has no built-in version history. Mitigations to bake into the project:
- Keep the **canonical shortcut logic in the repo** (export the `.shortcut` file + a plain-text spec of every action), so it can be rebuilt deterministically.
- Use **iCloud share links** as distributable backups (`Copy iCloud Link`) — these double as the install method for other users.
- Prefer a **thin shortcut** (just: match keyword → append raw SMS text + timestamp to a JSON file) and do **all parsing inside Maliya's JS**, not inside Shortcuts. A thin shortcut is trivial to rebuild and the valuable logic lives in version-controlled code, not in a fragile GUI automation.

---

## 3. Data ingestion architecture (three channels, one normalizer)

```
        ┌──────────────────────────────────────────────┐
        │  CHANNEL A: SMS (Shortcuts → JSON bridge)     │
        │  CHANNEL B: Statement import (PDF/Excel/CSV)  │
        │  CHANNEL C: Manual entry / Apple Pay txn      │
        └───────────────────┬──────────────────────────┘
                            ▼
                 NORMALIZER (one schema)
   { id, ts, amount, currency, direction(in/out),
     rawText, sourceChannel, counterpartyIBAN,
     counterpartyName, accountId, balanceAfter?,
     category, subCategory, tags[], confidence }
                            ▼
        DEDUP (hash of amount+date+counterparty+account)
                            ▼
              ACCOUNT/IBAN RESOLVER  (§4)
                            ▼
              CATEGORIZATION ENGINE  (§5)
                            ▼
                  STORE (on-device)
```

**Design rule:** every channel produces the *same normalized transaction object*. Parsing differences live only in the adapters; the rest of the app never knows where a transaction came from.

### Channel A — SMS adapter
Per-bank regex/parsers (you already have NBB Fawri+, BBK card, IBAN transfers). Extract: amount, currency, direction, counterparty IBAN/name, masked card tail, balance-after. Keep raw text for re-parsing if a format changes (PennyWise does "full SMS rescan" — store raw so you can reprocess).

### Channel B — Statement import (PDF / Excel / CSV)
Industry-proven **three-path pipeline** (from bankstatementparser / Koncile / Veryfi patterns):
- **Path 1 — Deterministic table parse:** digital PDFs with real tables and CSV/XLSX → parse directly. Fastest, free, no AI. (Use SheetJS for xlsx/csv; a JS PDF text extractor for text PDFs.)
- **Path 2 — Text-LLM:** messy digital PDFs with irregular layouts → feed extracted text to an LLM to structure it.
- **Path 3 — Vision-LLM / OCR:** scanned or photographed statements → multimodal/OCR.
- **Golden-Rule verification:** `opening_balance + credits − debits == closing_balance`. If it doesn't reconcile per currency, flag the import for review. This single check catches most parse errors.
- **Import UX (Koody pattern):** don't make users map columns. Auto-detect Date/Amount/Description, auto-categorize, **show an import-results summary** (X imported = Y expenses + Z income + N recurring), flag duplicates, allow bulk edit, and **remember edits** as rules. Importantly: **let the user assign the whole statement to a specific account** before import (your requirement), so every row inherits the right `accountId`.

### Channel C — Manual + Apple Pay
Manual quick-add (keep it 1-tap fast, Shortcuts widget / Action Button). Apple Pay via the iOS-17 Transaction automation.

---

## 4. IBAN & account-matching engine (your core differentiator)

This is the feature that makes Maliya smarter than generic SMS trackers. Bank SMS frequently **mask the IBAN** (e.g. `BH..XXXX...1234`) and the counterparty is far more reliable than a POS merchant string.

### 4.1 Matching logic (spec)
- **Full IBAN present → exact match.** Always preferred. Normalize (strip spaces, uppercase) and match against linked accounts.
- **Masked IBAN (`xxx` / `***`) → match on `prefix + suffix`.** Bahrain IBANs are 22 chars: `BH` + 2 check + 4 bank code + 14 BBAN. When the middle is masked, match on **country+check+bankcode (first ~8) + last N digits**. Require a **minimum suffix length (≥4)** to avoid false matches; if multiple linked accounts match the same prefix+suffix, ask the user to disambiguate once, then remember.
- **Confidence score** on every match: `full=1.0`, `prefix+suffix(≥6)=0.9`, `prefix+suffix(4–5)=0.7`, `name-only=0.5`. Show low-confidence matches for review rather than committing silently.

```js
function matchIBAN(observed, accounts) {
  const norm = s => (s||'').toUpperCase().replace(/\s+/g,'');
  const o = norm(observed);
  // 1) full exact
  let hit = accounts.find(a => norm(a.iban) === o && !o.includes('X'));
  if (hit) return { account: hit, confidence: 1.0, mode: 'full' };
  // 2) masked: prefix + suffix
  const digits = o.replace(/X+/g,'·');           // mark masked region
  const prefix = o.slice(0, 8);                   // BH + check + bankcode
  const suffix = (o.match(/(\d{4,})$/)||[])[1];   // trailing real digits
  if (suffix) {
    const cands = accounts.filter(a =>
      norm(a.iban).startsWith(prefix) && norm(a.iban).endsWith(suffix));
    if (cands.length === 1)
      return { account: cands[0], confidence: suffix.length>=6?0.9:0.7, mode:'masked' };
    if (cands.length > 1)
      return { ambiguous: cands, confidence: 0.6, mode:'masked-multi' };
  }
  // 3) nothing → unknown IBAN, trigger link alert
  return { account: null, confidence: 0, mode: 'unknown', observed: o };
}
```

### 4.2 New-IBAN alert → link flow (your requirement)
When `mode === 'unknown'`:
1. Park the transaction in an **"Unlinked / Needs review"** tray (do **not** drop it).
2. Raise a non-blocking **alert/badge**: *"New IBAN seen: BH•••1234 — link it?"*
3. The user links it to **an existing account** (it's one of their own — e.g. a transfer between their own accounts → "IBAN-to-own-account routing", which you already handle) **or** tags it as a **counterparty/merchant** (landlord, employer, a shop) with a default category.
4. **Remember the decision** as a rule → every future transaction with that IBAN auto-resolves. This is the learning loop that makes the app feel smart over time.

### 4.3 Counterparty/merchant directory
Maintain an on-device **IBAN → {name, type, defaultCategory}** map. Types: `own-account` (internal transfer, excluded from spend), `merchant/shop`, `person` (P2P/Fawri+), `employer` (income), `lender` (loan), `utility`. Because the **category is derived from the IBAN paid**, accuracy is far higher than SMS-merchant guessing.

---

## 5. Categorization engine

Layered, deterministic-first (cheap, predictable), AI-assist last (for the hard cases):

1. **Rule layer (highest priority):** user/learned rules keyed on **IBAN → category** (the strong signal), then on merchant substrings, then amount/recurrence patterns. Smart Rules with AND/OR (PennyWise pattern).
2. **Recurring/subscription detector:** flag transactions repeating at ~monthly cadence with similar amount + same counterparty → "subscription" (Rocket Money value-add). Surface them in a dedicated view.
3. **Category model:** 3-level hierarchy (Simplifi pattern): Group → Category → Subcategory, **unlimited custom**, with **Arabic names** (you already ship species/i18n with Arabic — reuse the i18n layer). Internal transfers (own-account IBAN) are **excluded from spend totals** by default.
4. **AI fallback (optional, on-device or API):** only for transactions still uncategorized after rules. Returns a category **with a confidence level** ("85% sure: Groceries") so the UI can ask rather than assume. Keep a **Private Mode** that never sends SMS text off-device (FinArt's stance) — important for trust.

---

## 6. Analytics & statistics (trends: daily → yearly)

What "more flexible than competitors" should mean concretely:

- **Time grains:** day / week / month / quarter / year, plus **custom range** and **rolling** (last 30/90/365 days). Free-scrub between grains.
- **Core views:**
  - *Cashflow* — income vs. spend per period, net, with running balance line.
  - *Category breakdown* — donut + ranked bars; tap to drill into transactions (label charts directly — don't make users decode legends).
  - *Trend over time* — stacked area / line per category; spot creep ("dining up 20% vs last month").
  - *Calendar heatmap* — spend per day (CalendarBudget pattern) to see rhythm and avoid overdrafts.
  - *Account view* — per-account balance history reconstructed from `balanceAfter` in SMS.
  - *Counterparty view* — top IBANs/shops/people you pay.
- **Insight cards (contextual, the retention driver):** "You've saved 20% more this month", "New recurring charge detected", "Unusually large transfer to BH•••1234". Insights should **lead to an action** (link IBAN, recategorize, set a budget).
- **Safe-to-spend number** (PocketGuard) on the home screen: income − bills − goals − spent = what's left.
- **Multi-currency** (BHD primary, USD/EUR/GCC) with per-currency balance verification on import.
- **Export:** CSV/Excel (SheetJS), ICS for bill due-dates (you already do ICS for Dry-Down), JSON backup (data ownership).

For charting in a single-file PWA: **Chart.js** (you've used it) or hand-rolled `<canvas>` (you did this in Dry-Down). Chart.js is the faster path to the polished multi-view dashboard.

---

## 7. Loans / debt module

- Track each loan: principal, APR, term, monthly installment, lender (link by **lender IBAN** so installment debits auto-attribute), start/end dates.
- **Auto-match installments:** a recurring debit to the lender IBAN → mark as loan payment, decrement balance, update payoff schedule.
- **Payoff schedule + progress bar** (Empower/PocketGuard pattern), remaining balance, interest paid to date, projected payoff date.
- **Income side:** salary detection via employer IBAN (or "income autopay" like PennyWise — recur income even when an SMS is missed).

---

## 8. Design system & UX principles (to actually beat the competition)

Synthesized from 2026 fintech-UX sources (Skins Factory, Onething, ProCreator, Yellow Slice, G&Co):

- **Trust is the product.** Clean, calm, predictable. Money apps are stressful; the UI must reduce anxiety, not add to it.
- **Color is signal, not decoration.** Neutral foundation, high-contrast data, **green/red used sparingly and only where meaning matters** (a red number in a balance carries weight). Avoid the "flat muted safe" trap — keep hierarchy and emphasis.
- **Glanceability over density.** A task that's 3 clicks on desktop should be 1 tap on mobile, or not exist on mobile. Big typography for the key number, generous whitespace, strong hierarchy.
- **Visual storytelling.** 82% of users trust apps more when data is shown visually (cited industry stat). Charts > tables. Label charts directly; highlight anomalies.
- **Dark + light mode** is baseline in 2026, not a differentiator. Ship both.
- **RTL + Arabic** done properly (you already do RTL/i18n) — a genuine regional edge none of the global apps match.
- **Biometric lock** (Face ID) for app entry — expected for finance.
- **Accessibility:** large tap targets, high-contrast mode, screen-reader labels (WCAG 2.2).
- **Microcopy:** clear, human, non-clinical error messages. "We couldn't read this statement — try a clearer PDF" not "ERR_PARSE_4xx".
- **Onboarding that delivers value in session one:** import one statement or capture one SMS and immediately show a populated dashboard, so the user sees the payoff before investing setup effort.

**Reference aesthetics worth studying:** Monzo / Revolut / N26 (clean, high-contrast, microinteractions); "Finewise" and "Money Manage" concept studies (soft cards, rounded shapes, color-coded sections, large type, glanceable analytics).

---

## 9. Suggested tech architecture (single-file / Scriptable-friendly)

- **Frontend:** single-file HTML PWA (your house style) or React if it grows. Tailwind-style utilities for speed. Chart.js for viz, SheetJS for xlsx/csv.
- **Storage:** on-device. For a real PWA use **IndexedDB** (not localStorage) for transaction volume; keep a JSON export/import for backup and for the Scriptable bridge.
- **SMS bridge:** thin Shortcut → append raw `{ts, text}` to a shared JSON in iCloud → app ingests + parses on open (and/or Shortcut calls the app). Keep parsing in JS, not in Shortcuts (§2).
- **Statement parsing:** deterministic JS first; LLM/vision only as fallback. If you use an API for the hard cases, gate it behind **Private Mode** and never send data without consent.
- **Sharing/distribution:** iCloud shortcut links for the automation; the PWA itself is "Add to Home Screen". For multi-user, the same offline-first model replicates per device.
- **Sync (optional, later):** if you ever want cross-device, prefer **end-to-end-encrypted** sync (CloudKit private DB or your own E2EE) to preserve the privacy promise.

---

## 10. Privacy posture (make it a selling point)

- **On-device by default**, no account required to start (PennyWise/FinArt Private Mode).
- **Raw SMS never leaves the phone** unless the user explicitly enables cloud AI for a transaction.
- **PII-aware:** store masked IBANs; redact on any export meant for sharing.
- **Full data ownership:** one-tap JSON/CSV export, no lock-in. This is a direct contrast to the bank-login data-harvesting model and resonates with the 2026 "privacy awareness" trend.

---

## 11. Feature comparison — where Maliya wins

| Capability | Global apps (Monarch/YNAB/Simplifi) | SMS apps (FinArt/PennyWise) | **Maliya target** |
|---|---|---|---|
| Works with GCC banks | ✗ (US sync) | partial | ✅ native (SMS + statements) |
| iPhone automatic capture | via sync | notif/SMS (mostly Android) | ✅ Shortcuts + Apple Pay txn |
| IBAN-based account resolve | ✗ | ✗ | ✅ full + masked (prefix+suffix) |
| New-IBAN link alert | ✗ | ✗ | ✅ review tray + learning rule |
| Statement import → specific account | partial | rare | ✅ assign account on import |
| Arabic / RTL | ✗ | rare | ✅ first-class |
| Offline / on-device | ✗ | some | ✅ default |
| Trends day→year, flexible | ✅ | partial | ✅ + calendar heatmap + counterparty view |
| Loans w/ IBAN auto-match | partial | partial | ✅ |
| Subscription detection | ✅ (Rocket) | partial | ✅ |
| Data ownership / export | partial | some | ✅ JSON/CSV/ICS |

**Maliya's defensible edges:** GCC/IBAN fit, the masked-IBAN matcher, the new-IBAN learning loop, Arabic, offline privacy, and the Shortcuts+Apple-Pay dual capture — none of which the incumbents do together.

---

## 12. Prioritized roadmap

**Phase 1 — Reliable capture (the foundation)**
- Harden SMS adapters (NBB, BBK, + add more Bahrain banks); store raw text for rescan.
- Thin Shortcut + JSON bridge + documented rebuild spec (so you never "lose" it again).
- IBAN resolver (full + masked) + unlinked tray + link flow.

**Phase 2 — Import & categorize**
- Statement import (CSV/XLSX deterministic first; PDF text; assign-to-account on import; Golden-Rule check; dedupe).
- Category hierarchy (3-level, Arabic) + learned IBAN→category rules + recurring detector.

**Phase 3 — Insight & design**
- Dashboard: safe-to-spend, cashflow, category donut, trend lines, calendar heatmap, account & counterparty views.
- Insight cards + contextual alerts. Dark/light, Face ID, RTL polish.

**Phase 4 — Depth**
- Loans module with IBAN installment matching; income/salary detection.
- Optional AI "ask your money" + AI fallback categorization (Private Mode gated).
- Export/backup (JSON/CSV/ICS), optional E2EE sync.

---

## 13. Sources (for follow-up reading)

- NerdWallet, CNBC Select, Kiplinger, Experian, Origin — best budgeting apps 2026 (Monarch, YNAB, Simplifi, PocketGuard, Empower).
- getfinny.app — SMS expense-tracking apps + Apple Shortcuts automations 2026 (iOS constraints, Walnut/Axio/Moneyview/FinArt).
- f-droid.org — PennyWise AI (on-device, Smart Rules, loans, subscriptions feature set).
- iauro.com / academia.edu — SMS-parsing architecture & accuracy notes.
- Apple Support + Matthew Cassinelli — Shortcuts communication triggers & iOS-17 Transaction automation.
- TechnoFino / TechTiff / MoneyCoach — real-world Shortcuts→Notes/Numbers expense pipelines.
- Pragmatic Coders — GCC open-banking landscape (Tarabut, Spare, Mod5r); meem/BisB/GIB Bahrain banks.
- bankstatementparser.com / Koncile / Parseur / Veryfi / Koody — statement-parsing pipeline (deterministic→LLM→vision), Golden-Rule verification, CSV-import UX.
- Skins Factory / Onething / ProCreator / Yellow Slice / G&Co / Artonest — 2026 fintech UI/UX (color-as-signal, glanceability, visual storytelling, trust).

*Note: bank SMS formats change without notice — every parser must store raw text and be re-runnable, and the masked-IBAN matcher should always degrade to the review tray rather than guess.*
