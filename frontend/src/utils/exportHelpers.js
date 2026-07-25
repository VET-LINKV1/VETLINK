/**
 * exportHelpers.js
 * CSV download (native Blob) + PDF (native window.print with print stylesheet).
 * No external dependencies required.
 */

/** Escape a single CSV field per RFC 4180. */
function csvField(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Quote when value contains comma, quote, newline, or leading/trailing whitespace
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Trigger a CSV download.
 *
 * @param {string} filename       e.g. "appointments-by-day.csv"
 * @param {string[]} headers       column headers
 * @param {Array<Array>} rows      array of row arrays (same order as headers)
 */
export function downloadCsv(filename, headers, rows) {
  const lines = [];
  lines.push(headers.map(csvField).join(','));
  for (const r of rows) {
    lines.push(r.map(csvField).join(','));
  }
  // Prepend BOM so Excel detects UTF-8 properly
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Convenience: convert a chart series to CSV.
 * Series can be:
 *   [{key, count}, ...]                      → "label,count"
 *   [{day, count}, ...]                      → "day,count"
 *   [{day, total, pending, ...}, ...]        → uses object keys
 */
export function downloadChartCsv(filename, series, columns = null) {
  if (!series || series.length === 0) {
    downloadCsv(filename, ['no data'], []);
    return;
  }
  const cols = columns || Object.keys(series[0]);
  const headers = cols;
  const rows = series.map((row) => cols.map((c) => row[c]));
  downloadCsv(filename, headers, rows);
}

/**
 * "PDF" export. Uses the browser's native Print dialog with a print
 * stylesheet that hides everything except the .health-check-printable
 * region. The user picks "Save as PDF" from the destination dropdown.
 *
 * Why not jsPDF/html2canvas? They add ~600KB of bundle and produce
 * lower-fidelity output than the browser's own print engine.
 */
export function exportPagePdf(suggestedFilename = 'health-check-report.pdf') {
  const original = document.title;
  document.title = suggestedFilename.replace(/\.pdf$/i, '');
  try {
    window.print();
  } finally {
    setTimeout(() => { document.title = original; }, 100);
  }
}
