/**
 * backgroundUploadTask — phase 2 of background uploads
 * (docs/superpowers/plans/2026-09-09-background-uploads.md).
 *
 * iOS grants a suspended or closed app short processing windows on its own
 * schedule (BGProcessingTask — usually while the phone idles on power or
 * Wi-Fi; never on demand). Android does the same through WorkManager. In such
 * a window iOS launches the app in the background: App.js runs, the provider
 * tree mounts, VaultUploadContext restores the persisted batch and its worker
 * resumes — exactly the launch path a normal open takes, minus the screen.
 * All this task has to do is hold the window open while that runs: it polls
 * the registered worker until the queue is idle or the budget is spent, and
 * hands the window back. The pool's fan-out (phase 1) does the rest: every
 * file it starts rides the background session past the end of the window.
 *
 * The task must be DEFINED at module scope, on every launch, before anything
 * else runs — App.js imports this module first. It is SCHEDULED only while a
 * batch has work left (the provider schedules on enqueue / leave and cancels
 * at done), so an idle app never asks iOS for windows.
 */
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';

export const BACKGROUND_UPLOAD_TASK = 'turtle-vault-upload-drain';
/** Stay well inside the window iOS grants (it can end a task after ~30 s of no progress). */
const BUDGET_MS = 25 * 1000;
const POLL_MS = 1000;
/** iOS/Android minimum; the OS may wait much longer. */
const MIN_INTERVAL_MINUTES = 15;

let worker = null; // { isBusy(): boolean, hasPending(): Promise<boolean>, kick(): void }

/** The provider lends the task a view of its queue. */
export function registerUploadWorker(w) {
  worker = w || null;
}

async function drain() {
  const started = Date.now();
  try { worker?.kick?.(); } catch { /* best effort */ }
  while (Date.now() - started < BUDGET_MS) {
    let pending = true;
    try { pending = !!worker && (worker.isBusy() || (await worker.hasPending())); } catch { pending = false; }
    if (!pending) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
  try {
    await drain();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.warn('[VaultUpload] background drain failed:', e?.message || e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Ask the OS for processing windows while work remains. Idempotent. */
export async function scheduleUploadDrain() {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    await BackgroundTask.registerTaskAsync(BACKGROUND_UPLOAD_TASK, { minimumInterval: MIN_INTERVAL_MINUTES });
    return true;
  } catch (e) {
    console.warn('[VaultUpload] could not schedule the background drain:', e?.message || e);
    return false;
  }
}

/** Nothing left to do: stop asking. */
export async function cancelUploadDrain() {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_UPLOAD_TASK)) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_UPLOAD_TASK);
    }
  } catch { /* nothing to undo */ }
}

/** Dev/diagnostics: whether the OS lets this app run background tasks at all. */
export async function backgroundDrainAvailable() {
  try { return (await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available; } catch { return false; }
}
