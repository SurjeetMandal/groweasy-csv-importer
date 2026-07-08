import { GoogleGenAI } from "@google/genai";
import {
  CRM_FIELD_ORDER,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  type CrmRecord,
  type RawCsvRow,
} from "./types";

const MODEL = "gemini-2.5-flash";
const BATCH_SIZE = 20;
const MAX_RETRIES = 2;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env.local file."
    );
  }
  return new GoogleGenAI({ apiKey });
}

// Split rows into fixed-size batches so we never blow past model context limits
// and so one bad batch doesn't take down the whole import.
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildPrompt(rows: RawCsvRow[]): string {
  return `You are a data-mapping engine for a real-estate CRM called GrowEasy. You will be given raw CSV rows exported from many different sources (Facebook Lead Ads, Google Ads, Excel sheets, other CRMs, manual sheets, etc). Column names, order, and casing vary between sources. Your job is to map each raw row onto a fixed CRM schema, using your best judgement about which raw column corresponds to which CRM field, even when headers are abbreviated, misspelled, differently ordered, or in a different language.

## Output contract
Return ONLY a JSON array, one object per input row, in the SAME ORDER as the input rows. No markdown fences, no commentary, no explanation — raw JSON only, because it will be parsed with JSON.parse().

Each object must have EXACTLY these keys (use null for anything you cannot confidently determine):
${CRM_FIELD_ORDER.map((f) => `- ${f}`).join("\n")}

## Field-specific rules

1. **crm_status**: Must be exactly one of: ${CRM_STATUS_VALUES.join(", ")}. Infer from any status/stage/quality column. If nothing matches confidently, use null.

2. **data_source**: Must be exactly one of: ${DATA_SOURCE_VALUES.join(", ")}. Only set this if a source/campaign/project column confidently matches one of these. Otherwise null — do NOT guess.

3. **created_at**: Output a value parseable by JavaScript's \`new Date(value)\`. Prefer ISO-like "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD". If no date exists in the row, use null.

4. **country_code**: A phone country code including the leading "+", e.g. "+91". If the mobile number already includes a country code, split it out here and leave only the local number in mobile_without_country_code. Default to "+91" ONLY if country is India and no code is present but you are confident the number is an Indian mobile number; otherwise null.

5. **mobile_without_country_code**: Digits only, no country code, no spaces, no dashes.

6. **Multiple emails/numbers**: If a row has more than one email, use the first as \`email\` and append the rest into \`crm_note\` (e.g. "Alt email: x@y.com"). Same rule for multiple mobile numbers: first goes to mobile_without_country_code, the rest go into crm_note.

7. **crm_note**: Use this catch-all for remarks, follow-up notes, extra contact details, or any useful raw-column content that doesn't map to a dedicated field. Combine multiple such bits with "; " separators. Never fabricate content that wasn't in the row.

8. **description**: Any free-text description/message/enquiry field distinct from crm_note (e.g. an enquiry message from an ad form). Use null if none exists.

9. **Never invent data.** If a field genuinely isn't present or inferable in a row, use null — do not hallucinate plausible-looking values.

10. Output must be valid JSON parsable by JSON.parse — double-quote all keys/strings, escape internal quotes and newlines, no trailing commas.

## Input rows (JSON array of raw CSV objects, arbitrary keys)
${JSON.stringify(rows)}
`;
}

function stripCodeFences(text: string): string {
  return text
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
}

function coerceEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | "" {
  if (typeof value !== "string") return "";
  return (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

function normalizeRecord(raw: unknown): CrmRecord {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const get = (key: keyof CrmRecord): string | null => {
    const v = obj[key];
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };

  return {
    created_at: get("created_at"),
    name: get("name"),
    email: get("email"),
    country_code: get("country_code"),
    mobile_without_country_code: get("mobile_without_country_code"),
    company: get("company"),
    city: get("city"),
    state: get("state"),
    country: get("country"),
    lead_owner: get("lead_owner"),
    crm_status: coerceEnum(obj.crm_status, CRM_STATUS_VALUES),
    crm_note: get("crm_note"),
    data_source: coerceEnum(obj.data_source, DATA_SOURCE_VALUES),
    possession_time: get("possession_time"),
    description: get("description"),
  };
}

async function extractBatch(
  rows: RawCsvRow[],
  attempt = 0
): Promise<CrmRecord[]> {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: buildPrompt(rows),
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const text = response.text ?? "";
    const cleaned = stripCodeFences(text);
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      throw new Error("AI response was not a JSON array");
    }
    if (parsed.length !== rows.length) {
      throw new Error(
        `AI returned ${parsed.length} records for ${rows.length} input rows`
      );
    }

    return parsed.map(normalizeRecord);
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      // Simple retry with backoff — batches occasionally fail due to
      // transient API errors or malformed JSON on the first try.
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      return extractBatch(rows, attempt + 1);
    }
    throw err;
  }
}

export interface ExtractionResult {
  records: CrmRecord[];
  sourceRows: RawCsvRow[];
  failedBatches: { rows: RawCsvRow[]; error: string }[];
}

export async function extractCrmRecords(
  rows: RawCsvRow[]
): Promise<ExtractionResult> {
  const batches = chunk(rows, BATCH_SIZE);
  const records: CrmRecord[] = [];
  const sourceRows: RawCsvRow[] = [];
  const failedBatches: { rows: RawCsvRow[]; error: string }[] = [];

  const results = await Promise.allSettled(
    batches.map((batch) => extractBatch(batch))
  );

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      records.push(...result.value);
      sourceRows.push(...batches[i]);
    } else {
      failedBatches.push({
        rows: batches[i],
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  });

  return { records, sourceRows, failedBatches };
}
