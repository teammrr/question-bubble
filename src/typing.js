// Simulated human typing. A script is planned up front from a seed, so the live
// preview and the exported video play back exactly the same keystrokes.

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

// Pauses (ms) around the typing, shared by live playback and video export
export const PAUSES = {
  start: 800, // sticker appears → first key
  afterQuestion: 500, // done with question → move to answer
  afterFocus: 400, // caret in answer → first key
  beforePop: 500, // done with answer → pop
};

export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

// Small seeded PRNG (mulberry32)
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 32);

// Delay before pressing `char`, loosely modelled on real keystroke timing
function keyDelay(char, prev, wpm, rand) {
  const between = (min, max) => min + rand() * (max - min);
  const base = 60000 / (wpm * 5); // a "word" is 5 characters
  let delay = base * between(0.5, 1.5);
  if (prev === " ") delay *= 1.3; // starting a new word
  if (/[.,!?;:]/.test(prev)) delay += between(250, 600); // end of a phrase
  if (/[A-Z]/.test(char)) delay *= 1.25; // reaching for shift
  if (rand() < 0.04) delay += between(300, 900); // thinking
  return delay;
}

// A key next to `char` on a QWERTY keyboard, or null if it isn't a letter
function neighborKey(char, rand) {
  const lower = char.toLowerCase();
  for (const row of KEY_ROWS) {
    const i = row.indexOf(lower);
    if (i === -1) continue;
    const options = [row[i - 1], row[i + 1]].filter(Boolean);
    const key = options[Math.floor(rand() * options.length)];
    return char === lower ? key : key.toUpperCase();
  }
  return null;
}

// [{ delay, key }] where key is a character or "Backspace"
function planKeystrokes(text, { wpm, typos }, rand) {
  const steps = [];
  let prev = "";
  // Array.from keeps emoji as a single "keystroke"
  for (const char of Array.from(text)) {
    let delay = keyDelay(char, prev, wpm, rand);

    const wrong = typos && rand() < 0.03 ? neighborKey(char, rand) : null;
    if (wrong) {
      steps.push({ delay, key: wrong });
      steps.push({ delay: 200 + rand() * 250, key: "Backspace" }); // notice the mistake
      delay = 120 + rand() * 130;
    }

    steps.push({ delay, key: char });
    prev = char;
  }
  return steps;
}

// Keystrokes for each text in order, from one seed ({ wpm, typos, seed })
export function planTexts(texts, options) {
  const rand = seededRandom(options.seed);
  return texts.map((text) => planKeystrokes(text, options, rand));
}

// Both fields' keystrokes for a script ({ question, answer, wpm, typos, seed })
export function planScript(script) {
  const [question, answer] = planTexts([script.question, script.answer], script);
  return { question, answer };
}

// ---------- Live playback into the contenteditable fields ----------

export function focusEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function press(el, key) {
  // Never type into anything but the sticker field, even if focus wandered
  if (document.activeElement !== el) focusEnd(el);
  if (key === "Backspace") document.execCommand("delete");
  else if (key === "\n") document.execCommand("insertLineBreak");
  else document.execCommand("insertText", false, key);
}

export async function typeSteps(el, steps, signal) {
  for (const { delay, key } of steps) {
    await sleep(delay, signal);
    press(el, key);
  }
}

// ---------- Timeline for rendering video frames ----------

export function applyKey(text, key) {
  return key === "Backspace" ? Array.from(text).slice(0, -1).join("") : text + key;
}

// Returns { duration, popAt, stateAt(ms) } with state = { question, answer, focus, lastKeyAt, popped }
export function buildTimeline(script, holdMs = 1500) {
  const plan = planScript(script);
  const events = []; // { t, field, value }
  let t = PAUSES.start;

  for (const field of ["question", "answer"]) {
    if (field === "answer") t += PAUSES.afterQuestion + PAUSES.afterFocus;
    let value = "";
    for (const { delay, key } of plan[field]) {
      t += delay;
      value = applyKey(value, key);
      events.push({ t, field, value });
    }
  }

  const answerFocusAt = PAUSES.start + sumDelays(plan.question) + PAUSES.afterQuestion;
  const popAt = t + PAUSES.beforePop;

  return {
    popAt,
    duration: popAt + 350 + holdMs,
    stateAt(ms) {
      const state = { question: "", answer: "", lastKeyAt: 0 };
      for (const e of events) {
        if (e.t > ms) break;
        state[e.field] = e.value;
        state.lastKeyAt = e.t;
      }
      state.focus = ms >= answerFocusAt ? "answer" : "question";
      if (ms >= answerFocusAt && state.lastKeyAt < answerFocusAt) state.lastKeyAt = answerFocusAt;
      state.popped = ms >= popAt;
      return state;
    },
  };
}

function sumDelays(steps) {
  return steps.reduce((sum, s) => sum + s.delay, 0);
}
