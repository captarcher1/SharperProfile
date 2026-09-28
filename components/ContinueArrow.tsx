// 2026-09-28 — a thick, green, animated arrow shown next to each of the 3
// forward-progress buttons (Step 1→2, Step 2→3, Step 3→4), so the eye has an
// obvious "look here, click this next" cue instead of having to scan the
// page for what to do. Paired with making those 3 buttons themselves muted
// by default (app/globals.css's `.continueButton`) — the arrow does the
// "look here" work, so the buttons don't have to shout on their own.
// aria-hidden: purely decorative, the button's own text already says what it
// does.
export function ContinueArrow() {
  return (
    <span className="continueArrow" aria-hidden="true">
      <svg viewBox="0 0 44 20" width="44" height="20">
        <line x1="2" y1="10" x2="32" y2="10" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M 24 1 L 42 10 L 24 19 Z" fill="currentColor" />
      </svg>
    </span>
  );
}
