import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  canEncodeVideo,
} from "mediabunny";
import { buildTimeline } from "./typing.js";
import { STICKER_GAP, drawSticker } from "./render.js";
import { SIZES } from "./useSettings.js";

// Same spring as the live pop-in: framer-motion stiffness 380, damping 18, mass 1
function spring(t) {
  const w0 = Math.sqrt(380);
  const zeta = 18 / (2 * w0);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
}

const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

// The "pop" after the answer: scale 1 → 1.06 → 1 over 350ms
function bumpScale(msSincePop) {
  const p = msSincePop / 350;
  if (p <= 0 || p >= 1) return 1;
  return p < 0.5 ? 1 + 0.06 * easeInOut(p * 2) : 1.06 - 0.06 * easeInOut((p - 0.5) * 2);
}

function loadImage(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Render the auto-type script to a video file.
 * options: { script, settings, size, fps, transparent, onProgress(0..1) }
 * Returns { blob, extension }.
 */
export async function exportVideo({ script, settings, size, fps, transparent, onProgress }) {
  const { width, height } = SIZES[size];
  const codec = transparent ? "vp9" : "avc";
  const encodeOptions = { width, height, quality: QUALITY_HIGH, alpha: transparent ? "keep" : "discard" };
  if (!(await canEncodeVideo(codec, encodeOptions))) {
    throw new Error(
      transparent
        ? "This browser can't encode transparent video. Try Chrome, or export MP4 with the green background."
        : "This browser can't encode MP4 (H.264) video. Try Chrome or Safari."
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: transparent });

  const output = new Output({
    format: transparent ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(canvas, {
    codec,
    quality: QUALITY_HIGH,
    alpha: transparent ? "keep" : "discard",
  });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();

  const timeline = buildTimeline(script);
  const look = {
    header: settings.header,
    shadow: settings.shadow,
    avatarImage: await loadImage(settings.avatar),
  };
  // Same on-screen proportion as the live page at 540px, scaled up to the video
  const baseScale = settings.scale * (Math.min(width, height) / 540);
  const frameCount = Math.ceil((timeline.duration / 1000) * fps);

  for (let i = 0; i < frameCount; i++) {
    const ms = (i / fps) * 1000;
    const typed = timeline.stateAt(ms);
    const sinceKey = ms - typed.lastKeyAt;
    const state = {
      ...typed,
      // Solid while typing, then blinks like a real caret
      caretVisible: !typed.popped && (sinceKey < 500 || Math.floor((sinceKey - 500) / 530) % 2 === 1),
    };

    ctx.clearRect(0, 0, width, height);
    if (!transparent) {
      ctx.fillStyle = settings.screen;
      ctx.fillRect(0, 0, width, height);
    }

    // Center the card like the page does (avatar overhang included)
    const entrance = spring(ms / 1000);
    drawSticker(ctx, state, look, {
      cx: width / 2,
      cy: height / 2 + (STICKER_GAP * baseScale) / 2,
      scale: baseScale * (0.4 + 0.6 * entrance) * bumpScale(ms - timeline.popAt),
      opacity: Math.min(1, Math.max(0, entrance)),
    });

    await source.add(i / fps, 1 / fps);
    onProgress?.((i + 1) / frameCount);
  }

  await output.finalize();
  return {
    blob: new Blob([output.target.buffer], { type: output.format.mimeType }),
    extension: output.format.fileExtension,
  };
}
