// Task cards are INVERTED against the screen (docs/STYLE-RULES.md §1): a
// black card with white text in light mode, a white card with black text in
// dark mode, so every card stands off the page instead of blending into it.
// Both TimelineTaskRow (calendar day panel, agenda) and TaskItem (the task
// list) draw from this one palette so they can never drift apart.
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
    };
}
