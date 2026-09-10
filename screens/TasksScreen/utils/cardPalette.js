// Task cards are INSET DARK panels (docs/STYLE-RULES.md §1) in BOTH modes:
// a charcoal surface — never pitch black — with a hairline rim a touch
// lighter than the panel and a lit top edge (the light catching the edge of
// a recess), white text, muted captions. The Teenage-Engineering /
// Scandinavian read of the reference tile. No drop shadow: a recess casts
// none. On the light page the dark panel is what makes a task stand off the
// page; on the dark page it sits a step ABOVE the black so it still reads
// as a panel. TimelineTaskRow, TaskItem, the board rail, the Overview tiles
// and the countdown badge all draw from this one palette.
export function insetCardPalette(theme) {
  const dark = theme?.mode === 'dark';
  return dark
    ? {
      /** Charcoal, a step above the black page. */
      card: '#17171A',
      text: '#F2F2F4',
      sub: 'rgba(255,255,255,0.68)',
      muted: 'rgba(255,255,255,0.48)',
      border: 'rgba(255,255,255,0.10)',
      field: 'rgba(255,255,255,0.07)',
      track: 'rgba(255,255,255,0.14)',
      /** Text drawn ON a `text`-coloured badge — i.e. the card colour. */
      onText: '#17171A',
      /** The rim: a hairline lighter than the panel, all the way round. */
      edge: 'rgba(255,255,255,0.11)',
      /** The lit top edge of the recess. */
      edgeTop: 'rgba(255,255,255,0.17)',
      /** Small icon tile inside a card (the cup in the reference). */
      tile: '#242429',
      shadow: {},
    }
    : {
      /** Charcoal on the white page — dark, not black. */
      card: '#1F2024',
      text: '#FFFFFF',
      sub: 'rgba(255,255,255,0.72)',
      muted: 'rgba(255,255,255,0.50)',
      border: 'rgba(255,255,255,0.10)',
      field: 'rgba(255,255,255,0.08)',
      track: 'rgba(255,255,255,0.16)',
      onText: '#1F2024',
      edge: 'rgba(255,255,255,0.12)',
      edgeTop: 'rgba(255,255,255,0.20)',
      tile: '#2C2D33',
      shadow: {},
    };
}

/** @deprecated name kept for one release; the palette is inset, not inverted. */
export const invertedCardPalette = insetCardPalette;
