// Decorative gradient watermark used on icon-led cards (Work, How I Work,
// Perspectives-style sections). Renders an oversized first letter of the
// title's first word over a soft radial wash in the bottom-right corner.
//
// The parent card must be `relative overflow-hidden`, and its real content
// must sit in a `relative` wrapper so it paints above this layer.

export const cardTints = [
  { wash: "rgba(15, 118, 110, 0.11)", letter: "rgba(15, 118, 110, 0.14)" }, // teal
  { wash: "rgba(37, 99, 235, 0.11)", letter: "rgba(37, 99, 235, 0.14)" }, // blue
  { wash: "rgba(124, 58, 237, 0.11)", letter: "rgba(124, 58, 237, 0.14)" }, // violet
  { wash: "rgba(219, 39, 119, 0.10)", letter: "rgba(219, 39, 119, 0.13)" }, // pink
  { wash: "rgba(217, 119, 6, 0.11)", letter: "rgba(217, 119, 6, 0.14)" }, // amber
  { wash: "rgba(5, 150, 105, 0.11)", letter: "rgba(5, 150, 105, 0.14)" }, // green
];

// Skips leading tokens that contain no letters, so "1. Frame the value"
// yields "F" rather than "1".
export function watermarkLetter(title: string): string {
  const firstWord = title
    .trim()
    .split(/\s+/)
    .find((word) => /[a-z]/i.test(word));
  return firstWord ? firstWord.replace(/[^a-z]/gi, "").charAt(0).toUpperCase() : "";
}

type CardWatermarkProps = {
  title: string;
  tintIndex: number;
};

export default function CardWatermark({ title, tintIndex }: CardWatermarkProps) {
  const letter = watermarkLetter(title);
  if (!letter) return null;

  const tint = cardTints[tintIndex % cardTints.length];

  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 select-none">
      <span
        className="absolute inset-0"
        style={{
          background: `radial-gradient(125% 105% at 100% 100%, ${tint.wash} 0%, rgba(255,255,255,0) 62%)`,
        }}
      />
      <span
        className="absolute -right-2 -bottom-6 text-[104px] leading-none font-semibold tracking-tight sm:-right-3 sm:-bottom-7 sm:text-[124px]"
        style={{ color: tint.letter }}
      >
        {letter}
      </span>
    </span>
  );
}
