// The live upload notification must say what has LANDED, not which item is
// being worked on (device report: "does not reflect how much has been
// uploaded"). progressBody is the pure part of that story.
import { progressBody } from '../uploadNotify';

describe('progressBody', () => {
  test('landed count leads; in-flight and remaining follow', () => {
    expect(progressBody({ uploaded: 12, total: 40, inflight: 8 })).toBe('12 of 40 uploaded · 8 in flight · 20 left');
  });
  test('duplicates and failures are named, never counted as left', () => {
    expect(progressBody({ uploaded: 38, total: 40, duplicates: 1, failed: 1 }))
      .toBe('38 of 40 uploaded · 1 duplicate skipped · 1 failed');
  });
  test('the final tick reads complete', () => {
    expect(progressBody({ uploaded: 40, total: 40 })).toBe('40 of 40 uploaded');
  });
});
