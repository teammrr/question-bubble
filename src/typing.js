// Simulated human typing into a focused contenteditable

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

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

const between = (min, max) => min + Math.random() * (max - min);

// Delay before pressing `char`, loosely modelled on real keystroke timing
function keyDelay(char, prev, wpm) {
  const base = 60000 / (wpm * 5); // a "word" is 5 characters
  let delay = base * between(0.5, 1.5);
  if (prev === " ") delay *= 1.3; // starting a new word
  if (/[.,!?;:]/.test(prev)) delay += between(250, 600); // end of a phrase
  if (/[A-Z]/.test(char)) delay *= 1.25; // reaching for shift
  if (Math.random() < 0.04) delay += between(300, 900); // thinking
  return delay;
}

// A key next to `char` on a QWERTY keyboard, or null if it isn't a letter
function neighborKey(char) {
  const lower = char.toLowerCase();
  for (const row of KEY_ROWS) {
    const i = row.indexOf(lower);
    if (i === -1) continue;
    const options = [row[i - 1], row[i + 1]].filter(Boolean);
    const key = options[Math.floor(Math.random() * options.length)];
    return char === lower ? key : key.toUpperCase();
  }
  return null;
}

function press(el, char) {
  // Never type into anything but the sticker field, even if focus wandered
  if (document.activeElement !== el) focusEnd(el);
  if (char === "\n") document.execCommand("insertLineBreak");
  else document.execCommand("insertText", false, char);
}

export function focusEnd(el) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

export async function typeText(el, text, { wpm, typos, signal }) {
  let prev = "";
  // Array.from keeps emoji as a single "keystroke"
  for (const char of Array.from(text)) {
    await sleep(keyDelay(char, prev, wpm), signal);

    const wrong = typos && Math.random() < 0.03 ? neighborKey(char) : null;
    if (wrong) {
      press(el, wrong);
      await sleep(between(200, 450), signal); // notice the mistake
      document.execCommand("delete");
      await sleep(between(120, 250), signal);
    }

    press(el, char);
    prev = char;
  }
}
