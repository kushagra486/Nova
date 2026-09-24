/**
 * Fixed, decorative gradient blobs behind the glass surfaces. Pure CSS
 * animation (not Framer Motion) since it's purely ambient — no meaning to
 * convey — and disabled entirely under prefers-reduced-motion (globals.css).
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="ambient-blob ambient-blob-a -top-40 -left-40 h-[32rem] w-[32rem]"
        style={{ background: "var(--glow-accent)" }}
      />
      <div
        className="ambient-blob ambient-blob-b top-1/3 -right-40 h-[36rem] w-[36rem]"
        style={{ background: "var(--glow-violet)" }}
      />
      <div
        className="ambient-blob ambient-blob-a bottom-0 left-1/3 h-[28rem] w-[28rem]"
        style={{ background: "var(--glow-accent)", animationDelay: "6s", opacity: 0.18 }}
      />
    </div>
  );
}
