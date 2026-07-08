import { NextRequest, NextResponse } from "next/server";
import { extractCrmRecords } from "@/lib/ai-extractor";
import { validateRecords } from "@/lib/validate";
import type { ImportRequestBody, ImportResponseBody } from "@/lib/types";

// Vercel/Next default body size limit is fine for CSVs in the few-MB range,
// but AI batch calls can take a while for large files — allow more time.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ImportRequestBody;

    if (!body || !Array.isArray(body.rows)) {
      return NextResponse.json<ImportResponseBody>(
        {
          success: false,
          imported: [],
          skipped: [],
          totalImported: 0,
          totalSkipped: 0,
          totalReceived: 0,
          error: "Request body must include a `rows` array.",
        },
        { status: 400 }
      );
    }

    if (body.rows.length === 0) {
      return NextResponse.json<ImportResponseBody>(
        {
          success: false,
          imported: [],
          skipped: [],
          totalImported: 0,
          totalSkipped: 0,
          totalReceived: 0,
          error: "CSV contained no rows to import.",
        },
        { status: 400 }
      );
    }

    const { records, sourceRows, failedBatches } = await extractCrmRecords(
      body.rows
    );

    const { imported, skipped } = validateRecords(records, sourceRows);

    // Rows whose AI batch failed entirely (even after retries) are reported
    // as skipped too, with a clear reason, rather than silently dropped.
    failedBatches.forEach(({ rows, error }) => {
      rows.forEach((row) => {
        skipped.push({ originalRow: row, reason: `AI extraction failed: ${error}` });
      });
    });

    return NextResponse.json<ImportResponseBody>({
      success: true,
      imported,
      skipped,
      totalImported: imported.length,
      totalSkipped: skipped.length,
      totalReceived: body.rows.length,
    });
  } catch (err) {
    console.error("Import failed:", err);
    return NextResponse.json<ImportResponseBody>(
      {
        success: false,
        imported: [],
        skipped: [],
        totalImported: 0,
        totalSkipped: 0,
        totalReceived: 0,
        error: err instanceof Error ? err.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
