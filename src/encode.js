// Shared video export: draw frames on a canvas and encode them in the browser
import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
  canEncodeVideo,
} from "mediabunny";

// Progress (0 → 1, with overshoot) of a framer-motion spring with mass 1 and no initial velocity
export function spring(seconds, stiffness, damping) {
  if (seconds <= 0) return 0;
  const w0 = Math.sqrt(stiffness);
  const zeta = damping / (2 * w0);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w0 * seconds) * (Math.cos(wd * seconds) + ((zeta * w0) / wd) * Math.sin(wd * seconds));
}

// Solid while typing, then blinks like a real caret
export function caretOn(msSinceKey) {
  return msSinceKey < 500 || Math.floor((msSinceKey - 500) / 530) % 2 === 1;
}

/**
 * Encode `durationMs` of animation. drawFrame(ctx, ms) paints one frame; the canvas is
 * cleared (transparent) or filled with `background` beforehand.
 * Returns { blob, extension }.
 */
export async function encodeVideo({ width, height, fps, transparent, background, durationMs, drawFrame, onProgress }) {
  const codec = transparent ? "vp9" : "avc";
  const alpha = transparent ? "keep" : "discard";
  if (!(await canEncodeVideo(codec, { width, height, quality: QUALITY_HIGH, alpha }))) {
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
  const source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH, alpha });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();

  const frameCount = Math.ceil((durationMs / 1000) * fps);
  for (let i = 0; i < frameCount; i++) {
    ctx.clearRect(0, 0, width, height);
    if (!transparent) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    drawFrame(ctx, (i / fps) * 1000);
    await source.add(i / fps, 1 / fps);
    onProgress?.((i + 1) / frameCount);
  }

  await output.finalize();
  return {
    blob: new Blob([output.target.buffer], { type: output.format.mimeType }),
    extension: output.format.fileExtension,
  };
}

export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
