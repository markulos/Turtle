// Task cards are INSET panels (docs/STYLE-RULES.md §1): a surface one step
// BELOW the page it sits on, with a hairline rim a touch lighter than the
// panel (the light catching the edge of a recess) — the Teenage-Engineering /
// Scandinavian read of the reference tile: dark panel, thin lighter border,
// bold value, muted caption. No drop shadow: a recess casts none.
// Both TimelineTaskRow (calendar day panel, agenda) and TaskItem (the task
// list) draw from this one palette so they can never drift apart.
export function insetCardPalette(theme) {
  const dark = theme?.mode === 'dark';
  return dark
    ? {
      /** A step below the black page — the recess. */
      card: '#0E0E10',
      text: '#E6E6E8',
      sub: 'rgba(255,255,255,0.62)',
      muted: 'rgba(255,255,255,0.45)',
      border: 'rgba(255,255,255,0.10)',
      field: 'rgba(255,255,255,0.06)',
      track: 'rgba(255,255,255,0.12)',
      /** Text drawn ON a `text`-coloured badge — i.e. the card colour. */
      onText: '#0E0E10',
      /** The rim: a hairline lighter than the panel, all the way round. */
      edge: 'rgba(255,255,255,0.10)',
      /** The lit top edge of the recess. */
      edgeTop: 'rgba(255,255,255,0.16)',
      /** Small icon tile inside a card (the cup in the reference). */
      tile: '#1C1D20',
      shadow: {},
    }
    : {
      card: '#F3F3F5',
      text: '#111111',
      sub: 'rgba(0,0,0,0.62)',
      muted: 'rgba(0,0,0,0.45)',
      border: 'rgba(0,0,0,0.08)',
      field: 'rgba(0,0,0,0.05)',
      track: 'rgba(0,0,0,0.10)',
      onText: '#F3F3F5',
      edge: 'rgba(0,0,0,0.08)',
      edgeTop: 'rgba(0,0,0,0.12)',
      tile: '#E7E7EA',
      shadow: {},
    };
}

/** @deprecated name kept for one release; the palette is inset, not inverted. */
export const invertedCardPalette = insetCardPalette;
