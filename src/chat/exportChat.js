// Renders the chat-bubble page to video, mirroring chat.css and the framer-motion props in ChatApp
import { caretOn, encodeVideo, spring } from "../encode.js";
import { roundRect, wrap } from "../render.js";
import { SIZES } from "../useSettings.js";
import { EXIT_MS, buildChatTimeline } from "./timeline.js";

const FONT = `16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif`;

// CSS px, from chat.css
const C = {
  padX: 30, // body padding: 100px 30px
  padBottom: 100,
  gap: 10, // #past-messages / #all-messages gap
  bubblePadX: 15, // padding: 8px 15px
  bubblePadY: 8,
  radius: 20,
  lineHeight: 18, // "normal" for 16px system font, as measured on the original page
  baseline: 14.5,
};

// framer-motion props on each past message: spring stiffness 100, damping 15
const move = (ms) => spring(ms / 1000, 100, 15);

const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

// One bubble in CSS px at the current transform: white box, optional tail, black text
function drawBubble(ctx, box, tail) {
  ctx.fillStyle = "#fff";
  roundRect(ctx, 0, 0, box.w, box.h, C.radius);
  ctx.fill();
  if (tail) {
    // A white :before with a background-colored :after bitten out of it
    ctx.save();
    ctx.beginPath();
    ctx.rect(-7, box.h - 20, 20, 20);
    ctx.roundRect(-10, box.h - 20, 10, 20, [0, 0, 10, 0]);
    ctx.clip("evenodd");
    ctx.beginPath();
    ctx.roundRect(-7, box.h - 20, 20, 20, [0, 0, 15, 0]);
    ctx.fill();
    ctx.restore();
  }
}

function drawText(ctx, lines) {
  ctx.fillStyle = "#000";
  lines.forEach((line, n) => ctx.fillText(line, C.bubblePadX, C.bubblePadY + n * C.lineHeight + C.baseline));
}

export async function exportChat({ script, settings, size, fps, transparent, onProgress }) {
  const { width, height } = SIZES[size];
  const lifetimeMs = settings.lifetime * 1000;
  const timeline = buildChatTimeline(script, { lifetimeMs });
  const { drafts } = timeline;

  // Page px → video px, then the Size setting (CSS zoom on #chat-container) on top
  const base = Math.min(width, height) / 540;
  const k = base * settings.scale;
  const left = C.padX * base;
  const inputBottom = height - C.padBottom * base;
  const maxWidth = (width - 2 * C.padX * base) / k; // bubble max-width, in bubble px

  const measure = document.createElement("canvas").getContext("2d");
  measure.font = FONT;
  function bubbleBox(text) {
    const lines = wrap(measure, text, maxWidth - 2 * C.bubblePadX);
    const w = Math.min(measure.measureText(text).width + 2 * C.bubblePadX, maxWidth);
    return { lines, w, h: lines.length * C.lineHeight + 2 * C.bubblePadY };
  }
  const boxes = drafts.map((d) => bubbleBox(d.text));

  // Unanimated layout at `ms`: input bubble box and each present message's top (video px)
  function layoutAt(ms) {
    const current = timeline.currentAt(ms);
    const input = bubbleBox(current.text);
    const inputTop = inputBottom - input.h * k;
    const tops = new Map();
    let y = inputTop - C.gap * k;
    for (let i = drafts.length - 1; i >= 0; i--) {
      const d = drafts[i];
      if (ms < d.sendAt || ms >= d.exitAt + EXIT_MS) continue;
      const top = y - boxes[i].h * k;
      tops.set(i, top);
      y = top - C.gap * k;
    }
    return { current, input, inputTop, tops };
  }

  // framer `layout`: every time a message's layout position jumps, it springs from the old spot
  const eventTimes = [...new Set(drafts.flatMap((d) => [...d.keys.map((key) => key.t), d.sendAt, d.exitAt + EXIT_MS]))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const jumps = drafts.map(() => []);
  const lastTop = new Map();
  for (const t of eventTimes) {
    for (const [i, top] of layoutAt(t).tops) {
      if (lastTop.has(i) && lastTop.get(i) !== top) jumps[i].push({ t, d: top - lastTop.get(i) });
      lastTop.set(i, top);
    }
  }

  return encodeVideo({
    width,
    height,
    fps,
    transparent,
    background: settings.screen,
    durationMs: timeline.duration,
    onProgress,
    drawFrame(ctx, ms) {
      const { current, input, inputTop, tops } = layoutAt(ms);
      ctx.font = FONT;
      ctx.textAlign = "left";
      const newest = Math.max(...tops.keys());

      for (const [i, layoutTop] of tops) {
        const d = drafts[i];
        let top = layoutTop + 40 * k * (1 - move(ms - d.sendAt)); // initial={{ y: 40 }}
        for (const j of jumps[i]) if (j.t <= ms) top -= j.d * (1 - move(ms - j.t));

        ctx.save();
        ctx.translate(left, top);
        ctx.scale(k, k);
        // exit={{ opacity: 0 }}
        if (ms >= d.exitAt) ctx.globalAlpha = Math.min(1, Math.max(0, 1 - move(ms - d.exitAt)));
        drawBubble(ctx, boxes[i], i === newest);
        drawText(ctx, boxes[i].lines);
        ctx.restore();
      }

      // The input bubble: invisible until typing starts, then fades in over 0.2s
      if (!current.typing) return;
      ctx.save();
      ctx.translate(left, inputTop);
      ctx.scale(k, k);
      ctx.save();
      ctx.globalAlpha = easeInOut(Math.min(1, (ms - current.typingFrom) / 200));
      drawBubble(ctx, input, true);
      ctx.restore();
      drawText(ctx, input.lines);
      if (caretOn(ms - current.lastKeyAt)) {
        const lastLine = input.lines[input.lines.length - 1];
        const x = C.bubblePadX + ctx.measureText(lastLine).width;
        ctx.fillRect(x, C.bubblePadY + (input.lines.length - 1) * C.lineHeight, 1, C.lineHeight);
      }
      ctx.restore();
    },
  });
}
