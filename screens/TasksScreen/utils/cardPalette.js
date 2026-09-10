// Task cards are INVERTED against the screen (docs/STYLE-RULES.md §1): a
// black card with white text in light mode, a white card with black text in
// dark mode, so every card stands off the page instead of blending into it.
// Both TimelineTaskRow (calendar day panel, agenda) and TaskItem (the task
// list) draw from this one palette so they can never drift apart.
// Depth: a soft drop shadow (iOS) + elevation (Android). The same values in
// both modes — on the dark page the shadow is quieter by nature, and the white
// card already stands off the black.
const SHADOW = {
  shadowColor: '#000000',
  shadowOpacity: 0.28,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
  elevation: 6,
};

export function invertedCardPalette(theme) {
  const dark = theme?.mode === 'dark';
  return dark
    ? {
      card: '#FFFFFF',
      text: '#000000',
      sub: 'rgba(0,0,0,0.62)',
      muted: 'rgba(0,0,0,0.45)',
      border: 'rgba(0,0,0,0.12)',
      field: 'rgba(0,0,0,0.06)',
      track: 'rgba(0,0,0,0.12)',
      /** Text drawn ON a `text`-coloured badge — i.e. the card colour. */
      onText: '#FFFFFF',
      /** The card's hairline edge — a faint dark rim on the white card. */
      edge: 'rgba(0,0,0,0.10)',
      shadow: SHADOW,
    }
    : {
      card: '#000000',
      text: '#FFFFFF',
      sub: 'rgba(255,255,255,0.72)',
      muted: 'rgba(255,255,255,0.5)',
      border: 'rgba(255,255,255,0.18)',
      field: 'rgba(255,255,255,0.1)',
      track: 'rgba(255,255,255,0.18)',
      onText: '#000000',
      /** A lit top edge so the black card reads as a raised object, not a hole. */
      edge: 'rgba(255,255,255,0.16)',
      shadow: SHADOW,
    };
}
