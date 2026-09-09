/**
 * Store subscriptions for the viewer's pages.
 *
 * MediaGallery keeps two hand-rolled stores ({ get, set/mark, subscribe }) so
 * pager-hot values can change WITHOUT re-rendering the gallery: which page is
 * active, and which photos have their HD variant warm on disk. A page
 * subscribes to a DERIVED BOOLEAN, never the raw value, so a page change
 * re-renders exactly the two pages whose answer changed (React bails out on an
 * identical state value) and an HD arrival re-renders exactly one.
 *
 * Moved verbatim from viewerMedia.jsx; the discipline is device-measured
 * (a per-cell subscription to the raw active id was a 150ms median JS block on
 * the frame a finger landed).
 */
import { useEffect, useState } from 'react';

/** "Is THIS page the active one?" */
export function useIsActive(store, id) {
  const [active, setActive] = useState(() => (store ? store.get() === id : false));
  useEffect(() => {
    if (!store) { setActive(false); return undefined; }
    setActive(store.get() === id);
    return store.subscribe((value) => setActive(value === id));
  }, [store, id]);
  return active;
}

/** "Is this photo's HD variant warm?" — flips once, on a quiet frame, never back. */
export function useHdReady(store, id) {
  const [ready, setReady] = useState(() => (store ? !!store.get(id) : false));
  useEffect(() => {
    if (!store) { setReady(false); return undefined; }
    setReady(!!store.get(id));
    return store.subscribe((changedId) => {
      if (changedId === id) setReady(true);
    });
  }, [store, id]);
  return ready;
}
