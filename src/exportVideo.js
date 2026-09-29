import { buildTimeline } from "./typing.js";
import { STICKER_GAP, drawSticker } from "./render.js";
import { SIZES } from "./useSettings.js";
import { caretOn, encodeVideo, loadImage, spring } from "./encode.js";

const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

// The "pop" after the answer: scale 1 → 1.06 → 1 over 350ms
function bumpScale(msSincePop) {
  const p = msSincePop / 350;
  if (p <= 0 || p >= 1) return 1;
  return p < 0.5 ? 1 + 0.06 * easeInOut(p * 2) : 1.06 - 0.06 * easeInOut((p - 0.5) * 2);
}

/**
 * Render the auto-type script to a video file.
 * options: { script, settings, size, fps, transparent, onProgress(0..1) }
 * Returns { blob, extension }.
 */
export async function exportVideo({ script, settings, size, fps, transparent, onProgress }) {
  const { width, height } = SIZES[size];
  const timeline = buildTimeline(script);
  const look = {
    header: settings.header,
    shadow: settings.shadow,
    avatarImage: await loadImage(settings.avatar),
  };
  // Same on-screen proportion as the live page at 540px, scaled up to the video
  const baseScale = settings.scale * (Math.min(width, height) / 540);

  return encodeVideo({
    width,
    height,
    fps,
    transparent,
    background: settings.screen,
    durationMs: timeline.duration,
    onProgress,
    drawFrame(ctx, ms) {
      const typed = timeline.stateAt(ms);
      const state = { ...typed, caretVisible: !typed.popped && caretOn(ms - typed.lastKeyAt) };
      // Same spring as the live pop-in (framer-motion stiffness 380, damping 18)
      const entrance = spring(ms / 1000, 380, 18);
      // Center the card like the page does (avatar overhang included)
      drawSticker(ctx, state, look, {
        cx: width / 2,
        cy: height / 2 + (STICKER_GAP * baseScale) / 2,
        scale: baseScale * (0.4 + 0.6 * entrance) * bumpScale(ms - timeline.popAt),
        opacity: Math.min(1, Math.max(0, entrance)),
      });
    },
  });
}
