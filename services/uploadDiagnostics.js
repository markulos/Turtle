/**
 * uploadDiagnostics — the upload pipeline's error logger.
 *
 * Every anomaly the vault uploader can detect but not fully explain on the
 * phone (a task whose completion never came back after a suspension, a
 * watchdog trip, an item re-queued or failed) is logged to the console AND
 * filed as a feedback to-do in the Notes tab — the same shape the gesture
 * probe files (tags Turtle App / Mobile app), so the fixes can be scheduled
 * from the notes later with the facts attached, instead of from memory.
 *
 * Deduped per kind for the life of the JS session and capped, so a bad
 * night can't spam the notes: the FIRST occurrence of each kind is filed with
 * its details; later ones only bump a counter in the console.
 */
const FEEDBACK_TAGS = ['Turtle App', 'Mobile app', 'bug', 'uploads'];
const MAX_NOTES_PER_SESSION = 6;

const filed = new Map(); // kind → count
let notesFiled = 0;

function buildDescription(kind, details) {
  const lines = [
    `Upload pipeline anomaly: ${kind}`,
    `When: ${new Date().toISOString()}`,
    '',
    'Details:',
    ...Object.entries(details || {}).map(([k, v]) => `  ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`),
    '',
    'Where to look: mobile-app/context/VaultUploadContext.jsx (pool + reconcile), services/streamMultipartUpload.js (watchdog),',
    'docs/superpowers/plans/2026-09-09-background-uploads.md (phase 1 limits: JS sleeps while backgrounded).',
  ];
  return lines.join('\n');
}

/**
 * Log an anomaly. `ctx` = { getBaseUrl, token } — the pond and the session
 * to file the note under; missing either → console only.
 */
export function reportUploadIssue(kind, details = {}, ctx = {}) {
  const count = (filed.get(kind) || 0) + 1;
  filed.set(kind, count);
  const summary = `[VaultUpload] ⚠ ${kind}${count > 1 ? ` (×${count})` : ''} ${JSON.stringify(details)}`;
  console.warn(summary);
  if (count > 1 || notesFiled >= MAX_NOTES_PER_SESSION) return Promise.resolve(false);
  notesFiled += 1;

  const base = typeof ctx.getBaseUrl === 'function' ? ctx.getBaseUrl() : ctx.baseUrl;
  if (!base) return Promise.resolve(false);
  const endpoint = base.endsWith('/api') ? `${base}/turtle/note` : `${base}/api/turtle/note`;
  const title = `Mobile feedback: uploads — ${kind}`;
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(ctx.token ? { Authorization: `Bearer ${ctx.token}` } : {}) },
    body: JSON.stringify({
      // Both field names on purpose (older handlers read `note`).
      note: title,
      content: title,
      description: buildDescription(kind, details),
      type: 'todo',
      done: false,
      tags: FEEDBACK_TAGS,
    }),
  })
    .then((r) => r.json())
    .then((res) => !!(res && res.success !== false && res.noteId))
    .catch(() => false);
}

/** Test hook. */
export function _resetUploadDiagnostics() {
  filed.clear();
  notesFiled = 0;
}
