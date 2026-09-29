import { PAUSES, applyKey, planTexts } from "../typing.js";

// Pauses (ms) between chat messages, shared by live playback and video export
export const CHAT_PAUSES = {
  beforeSend: 350, // done typing → Enter
  afterSend: 700, // Enter → start of the next message
};

// How long framer-motion's exit (opacity spring) takes before the bubble leaves the layout
export const EXIT_MS = 700;

/**
 * Keystroke-level timeline for a chat script ({ messages: [...], wpm, typos, seed }).
 * Each draft: { keys: [{ t, value }], typingFrom, sendAt, text, exitAt }
 */
export function buildChatTimeline(script, { lifetimeMs, holdMs = 2500 }) {
  const plans = planTexts(script.messages, script);
  const drafts = [];
  let t = PAUSES.start;

  plans.forEach((steps, i) => {
    if (i > 0) t += CHAT_PAUSES.afterSend;
    let value = "";
    const keys = [];
    for (const { delay, key } of steps) {
      t += delay;
      value = applyKey(value, key);
      keys.push({ t, value });
    }
    const sendAt = t + CHAT_PAUSES.beforeSend;
    drafts.push({
      keys,
      typingFrom: keys.length ? keys[0].t : sendAt,
      sendAt,
      text: value,
      exitAt: lifetimeMs > 0 ? sendAt + lifetimeMs : Infinity,
    });
    t = sendAt;
  });

  return {
    drafts,
    duration: t + holdMs,
    // What's in the input bubble at `ms`: { typing, text, typingFrom, lastKeyAt }
    currentAt(ms) {
      for (const d of drafts) {
        if (ms < d.typingFrom || ms >= d.sendAt) continue;
        let text = "";
        let lastKeyAt = d.typingFrom;
        for (const k of d.keys) {
          if (k.t > ms) break;
          text = k.value;
          lastKeyAt = k.t;
        }
        return { typing: true, text, typingFrom: d.typingFrom, lastKeyAt };
      }
      return { typing: false, text: "" };
    },
  };
}
