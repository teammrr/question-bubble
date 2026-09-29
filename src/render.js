// Draws the sticker onto a canvas, mirroring the CSS in index.css (sizes in CSS px)

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif';

const L = {
  width: 320,
  radius: 22,
  avatarGap: 30, // .sticker margin-top
  avatar: 58,
  avatarBorder: 3,
  header: { top: 40, side: 22, bottom: 18 },
  body: { top: 16, side: 18, bottom: 18 },
  answerPad: { y: 12, x: 14 },
  question: { font: `700 21px ${FONT}`, lineHeight: 26.25, color: "#fff", placeholder: "rgba(255,255,255,0.7)" },
  answer: { font: `500 18px ${FONT}`, lineHeight: 23.4, color: "#262626" },
  placeholderFont: `400 18px ${FONT}`,
};

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// Word-wrap like `white-space: pre-wrap`, using Intl.Segmenter so Thai (no spaces) breaks correctly
function wrap(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const { segment } of segmenter.segment(paragraph)) {
      const next = line + segment;
      if (ctx.measureText(next.trimEnd()).width <= maxWidth || line === "") {
        line = next;
      } else {
        lines.push(line.trimEnd());
        line = segment.trimStart();
      }
      // A single word wider than the line: break it by character
      while (ctx.measureText(line).width > maxWidth) {
        let head = "";
        for (const { segment: g } of graphemes.segment(line)) {
          if (ctx.measureText(head + g).width > maxWidth && head) break;
          head += g;
        }
        lines.push(head);
        line = line.slice(head.length);
      }
    }
    lines.push(line);
  }
  return lines;
}

// Supports the preset formats: a solid color or linear-gradient(<angle>deg, color [pos%], ...)
function headerFill(ctx, css, x, y, w, h) {
  const match = css.match(/^linear-gradient\((.*)\)$/);
  if (!match) return css;
  const parts = match[1].split(/,(?![^(]*\))/).map((p) => p.trim());
  const angle = (parseFloat(parts.shift()) * Math.PI) / 180;
  // CSS gradient line: through the center, long enough to reach the corners
  const len = Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle));
  const dx = (Math.sin(angle) * len) / 2;
  const dy = (-Math.cos(angle) * len) / 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  parts.forEach((part, i) => {
    const [color, pos] = part.split(/\s+(?=[\d.]+%$)/);
    gradient.addColorStop(pos ? parseFloat(pos) / 100 : i / (parts.length - 1), color);
  });
  return gradient;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Measure both text blocks (at scale 1) to get the card height
export function layoutSticker(ctx, state) {
  ctx.font = L.question.font;
  const qLines = wrap(ctx, state.question, L.width - 2 * L.header.side);
  ctx.font = L.answer.font;
  const aLines = wrap(ctx, state.answer, L.width - 2 * L.body.side - 2 * L.answerPad.x);
  const headerH = L.header.top + qLines.length * L.question.lineHeight + L.header.bottom;
  const answerH = aLines.length * L.answer.lineHeight + 2 * L.answerPad.y;
  const bodyH = L.body.top + answerH + L.body.bottom;
  return { qLines, aLines, headerH, answerH, height: headerH + bodyH };
}

function drawLines(ctx, lines, centerX, top, lineHeight, fontSize) {
  // Baseline roughly where the browser puts it for this line-height
  const baseline = (lineHeight - fontSize) / 2 + fontSize * 0.8;
  lines.forEach((line, i) => ctx.fillText(line, centerX, top + i * lineHeight + baseline));
}

// Caret after the last line, or before the placeholder when the field is empty
function drawCaret(ctx, lines, centerX, top, lineHeight, fontSize, color, empty) {
  const halfWidth = ctx.measureText(lines[lines.length - 1]).width / 2;
  const x = empty ? centerX - halfWidth - 2 : centerX + halfWidth + 1;
  const y = top + (lines.length - 1) * lineHeight + (lineHeight - fontSize * 1.15) / 2;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 2, fontSize * 1.15);
}

/**
 * Draw one frame.
 * state: { question, answer, focus, caretVisible }
 * look:  { header, avatarImage, shadow }
 * at:    { cx, cy, scale, opacity } — card center in canvas px and its total scale
 */
export function drawSticker(ctx, state, look, at) {
  const layout = layoutSticker(ctx, state);
  const { qLines, aLines, headerH, answerH, height } = layout;

  ctx.save();
  ctx.globalAlpha = at.opacity;
  ctx.translate(at.cx, at.cy);
  ctx.scale(at.scale, at.scale);
  ctx.translate(-L.width / 2, -height / 2);
  ctx.textAlign = "center";

  // Card
  if (look.shadow) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 30 * at.scale;
    ctx.shadowOffsetY = 10 * at.scale;
    ctx.fillStyle = "#fff";
    roundRect(ctx, 0, 0, L.width, height, L.radius);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = "#fff";
  roundRect(ctx, 0, 0, L.width, height, L.radius);
  ctx.fill();

  // Header
  ctx.fillStyle = headerFill(ctx, look.header, 0, 0, L.width, headerH);
  roundRect(ctx, 0, 0, L.width, headerH, [L.radius, L.radius, 0, 0]);
  ctx.fill();

  // Question
  const qTop = L.header.top;
  ctx.font = L.question.font;
  if (state.question) {
    ctx.fillStyle = L.question.color;
    drawLines(ctx, qLines, L.width / 2, qTop, L.question.lineHeight, 21);
  } else {
    ctx.fillStyle = L.question.placeholder;
    drawLines(ctx, ["Ask me a question"], L.width / 2, qTop, L.question.lineHeight, 21);
  }
  if (state.focus === "question" && state.caretVisible) {
    const lines = state.question ? qLines : ["Ask me a question"];
    drawCaret(ctx, lines, L.width / 2, qTop, L.question.lineHeight, 21, L.question.color, !state.question);
  }

  // Answer (grey "Type something..." box while empty)
  const boxX = L.body.side;
  const boxY = headerH + L.body.top;
  const boxW = L.width - 2 * L.body.side;
  const aTop = boxY + L.answerPad.y;
  if (!state.answer) {
    ctx.fillStyle = "#efefef";
    roundRect(ctx, boxX, boxY, boxW, answerH, 12);
    ctx.fill();
    ctx.font = L.placeholderFont;
    ctx.fillStyle = "#8e8e8e";
    drawLines(ctx, ["Type something..."], L.width / 2, aTop, L.answer.lineHeight, 18);
  } else {
    ctx.font = L.answer.font;
    ctx.fillStyle = L.answer.color;
    drawLines(ctx, aLines, L.width / 2, aTop, L.answer.lineHeight, 18);
  }
  if (state.focus === "answer" && state.caretVisible) {
    ctx.font = state.answer ? L.answer.font : L.placeholderFont;
    const lines = state.answer ? aLines : ["Type something..."];
    drawCaret(ctx, lines, L.width / 2, aTop, L.answer.lineHeight, 18, L.answer.color, !state.answer);
  }

  // Avatar, centered on the top edge
  const r = L.avatar / 2;
  ctx.beginPath();
  ctx.arc(L.width / 2, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(L.width / 2, 0, r - L.avatarBorder, 0, Math.PI * 2);
  ctx.clip();
  if (look.avatarImage) {
    const d = 2 * (r - L.avatarBorder);
    ctx.drawImage(look.avatarImage, L.width / 2 - d / 2, -d / 2, d, d);
  } else {
    ctx.fillStyle = "#dbdbdb";
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
  return layout;
}

export const STICKER_GAP = L.avatarGap;
