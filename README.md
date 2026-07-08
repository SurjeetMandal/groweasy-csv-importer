# GrowEasy — AI-Powered CSV Lead Importer

An AI-powered CSV importer built for GrowEasy's CRM. It solves a very specific problem: **CRM lead exports never come in the same shape twice.** A Facebook Lead Ads export looks nothing like a Google Ads export, which looks nothing like an Excel sheet a sales rep filled in by hand. Different column names, different orders, different date formats, sometimes multiple phone numbers crammed into one cell.

Instead of forcing users to reformat their CSV to match a rigid template, this app lets them upload **any** CSV and uses an AI model to read the data the way a human would — understanding what each column *means*, not just what it's *named* — and maps it into GrowEasy's fixed CRM schema automatically.

---

## What the app actually does, step by step

### 1. Upload
The user drags in (or picks) a `.csv` file. No file format assumptions are made — headers can be anything.

### 2. Preview (no AI yet)
The CSV is parsed **entirely in the browser** using PapaParse. Nothing is sent to any server or AI at this point — this is just a fast, free sanity check so the user can see their raw data rendered in a table (sticky headers, horizontal + vertical scrolling for wide/long files) before committing to anything.

This matters for cost and trust: if someone uploads the wrong file, they see it immediately and can start over without ever touching the AI.

### 3. Confirm
Only when the user clicks **"Confirm & Import"** does the raw parsed rows get sent to the backend as JSON. This is the one deliberate "point of no return" in the flow.

### 4. AI Extraction (the core of the assignment)
On the backend:
- Rows are split into **batches of 20** (so a 500-row CSV becomes 25 small requests instead of one giant one that could hit token limits or time out)
- Each batch is sent to **Google Gemini (`gemini-2.5-flash`)** along with a detailed prompt that:
  - Describes the exact 15 CRM fields required (`name`, `email`, `mobile_without_country_code`, `crm_status`, etc.)
  - Tells the model the closed set of allowed values for `crm_status` (e.g. `GOOD_LEAD_FOLLOW_UP`, `SALE_DONE`) and `data_source` (e.g. `eden_park`, `varah_swamy`) — the model must pick from these or leave the field blank, never invent new values
  - Gives explicit rules for edge cases: what to do with multiple emails/phone numbers in one row (keep the first, stash the rest in `crm_note`), how dates should be formatted, when to leave a field `null` instead of guessing
- The model's JSON response is parsed, and each field is coerced/sanitized (e.g. any `crm_status` value that isn't in the allowed list gets reset to blank rather than trusted blindly)
- If a batch fails (bad JSON, API error, timeout), it's **automatically retried up to 2 times** with a short backoff before being given up on — and even then, those rows are reported back as "skipped" with a clear reason instead of just vanishing

### 5. Validation (a safety net independent of the AI)
Regardless of what the AI decides, the backend enforces one hard rule itself: **any record with neither an email nor a mobile number is skipped.** This isn't left up to the AI's judgment — it's checked in plain code after extraction, so it's guaranteed to be applied correctly every time.

### 6. Results
The user sees two tabs:
- **Imported** — the successfully mapped CRM records, in a table matching the CRM's actual field order
- **Skipped** — every record that got dropped, with the original raw row *and* a plain-English reason why (no email/phone, or AI extraction failed for that batch)

Stats at the top show Total Received / Imported / Skipped at a glance.

---

## Why this design

**Client-side preview, server-side AI.** Parsing happens in the browser so previewing a file costs nothing and shows instantly. AI calls only happen once, after explicit user confirmation — this avoids wasting API quota on files the user was just browsing.

**Batching.** Real CRM exports can have hundreds or thousands of rows. Sending them all in one AI request risks hitting context limits and means one bad row can silently corrupt the whole batch's output. Batching in groups of 20 keeps requests fast, keeps failures isolated, and keeps the AI's output easier to validate.

**The AI is not blindly trusted.** Enum fields (`crm_status`, `data_source`) are validated against the allowed list after the AI responds — if the model returns something outside that list, it's overwritten with blank rather than passed through. The "skip if no email/phone" rule is also re-checked in code, not left purely to the prompt. This two-layer approach (good prompting + code-level validation) is what makes the pipeline production-safe rather than "hope the AI behaves."

**Single Next.js app instead of separate Next.js + Express.** The assignment describes a frontend/backend split. Here, Next.js API routes serve as the backend — they run on Node.js and are the standard way to build a backend in the Next.js ecosystem, while keeping one deployable unit and no CORS setup. All business logic (`lib/ai-extractor.ts`, `lib/validate.ts`) is written independently of the HTTP layer, so it could be moved into a standalone Express server with minimal changes if that's strictly required.

---

## Tech Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes (Node.js runtime)
- **CSV Parsing:** PapaParse (runs client-side)
- **AI:** Google Gemini (`gemini-2.5-flash`) via the `@google/genai` SDK
- **Upload UX:** react-dropzone (drag & drop + file picker)

## Project Structure

```
app/
  page.tsx                    → main UI flow: upload → preview → confirm → results
  api/import-leads/route.ts   → the one API endpoint; orchestrates extraction + validation
components/
  CsvUploader.tsx             → drag & drop / file picker + client-side CSV parsing
  PreviewTable.tsx            → raw CSV preview (sticky header, scrollable, pre-AI)
  ResultsTable.tsx            → imported / skipped results with stats and tabs
lib/
  types.ts                    → shared CRM schema, enums, and API request/response types
  ai-extractor.ts             → prompt engineering, batching, retries, JSON parsing/coercion
  validate.ts                 → the email-or-mobile skip rule
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**

   Create a `.env.local` file in the project root:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Run the dev server**
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

### Build for production
```bash
npm run build
npm start
```

---

## CRM Field Mapping Rules

| Rule | Behavior |
|---|---|
| `crm_status` | Constrained to `GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE` — anything else becomes blank |
| `data_source` | Constrained to `leads_on_demand`, `meridian_tower`, `eden_park`, `varah_swamy`, `sarjapur_plots` — left blank if no confident match |
| `created_at` | Always formatted to be parseable by `new Date(...)` |
| Multiple emails/phones | First one kept in its dedicated field; the rest appended into `crm_note` |
| Missing email AND phone | Record is skipped, with the reason shown to the user |

## Error Handling & Resilience

- CSV parsing errors (bad delimiters, empty files) are caught client-side before any API call happens
- AI batches are retried automatically (up to 2 retries with backoff) on failure
- If a batch still fails after retries, its rows appear in the Skipped tab with a clear reason instead of disappearing silently
- The API route validates the incoming request shape and returns clear error messages for empty/malformed uploads

## Known Limitations / Possible Future Improvements

- Stateless by design — no persistent database (allowed by the assignment)
- No per-batch progress indicator yet — a single loading state covers the whole extraction
- No automated test suite yet
- Large files (1000+ rows) will take longer since batches are currently processed with `Promise.allSettled` — could be parallelized further with a concurrency limit
