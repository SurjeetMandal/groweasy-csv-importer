import type { CrmRecord, RawCsvRow, SkippedRecord } from "./types";

export interface ValidationOutcome {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
}

// Rule from the assignment: if a record has neither an email nor a mobile
// number, it must be skipped rather than imported.
// NOTE: records[i] must correspond to originalRows[i] (see ai-extractor's
// ExtractionResult.sourceRows, which is built precisely for this pairing).
export function validateRecords(
  records: CrmRecord[],
  originalRows: RawCsvRow[]
): ValidationOutcome {
  const imported: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  records.forEach((record, i) => {
    const hasEmail = !!record.email;
    const hasMobile = !!record.mobile_without_country_code;

    if (!hasEmail && !hasMobile) {
      skipped.push({
        originalRow: originalRows[i] ?? {},
        reason: "No email or mobile number found in this record",
      });
      return;
    }

    imported.push(record);
  });

  return { imported, skipped };
}
