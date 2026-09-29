import { useEffect, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { PAUSES, focusEnd, planScript, sleep, typeSteps } from "./typing.js";

// contenteditable leaves a stray <br> when emptied, which breaks the :empty placeholder
function tidy(el) {
  if (el.textContent === "") el.innerHTML = "";
}

function pastePlainText(e) {
  e.preventDefault();
  document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
}

export default function Sticker({ header, avatar, shadow, initialQuestion, onQuestionChange, script }) {
  const questionRef = useRef(null);
  const answerRef = useRef(null);
  const controls = useAnimationControls();
  const [idle, setIdle] = useState(false);

  function pop() {
    setIdle(true);
    controls.start({ scale: [1, 1.06, 1], transition: { duration: 0.35 } });
  }

  useEffect(() => {
    const question = questionRef.current;
    const answer = answerRef.current;

    if (!script) {
      question.textContent = initialQuestion;
      focusEnd(initialQuestion ? answer : question);
      return;
    }

    // Auto-type: question, Enter, answer, Enter — like a person would
    const abort = new AbortController();
    const signal = AbortSignal.any([abort.signal, script.signal]);
    const plan = planScript(script);
    (async () => {
      focusEnd(question);
      await sleep(PAUSES.start, signal);
      await typeSteps(question, plan.question, signal);
      await sleep(PAUSES.afterQuestion, signal);
      focusEnd(answer);
      await sleep(PAUSES.afterFocus, signal);
      await typeSteps(answer, plan.answer, signal);
      await sleep(PAUSES.beforePop, signal);
      pop();
    })().catch(() => {
      /* stopped: Esc, a new run, or the settings panel opened */
    });
    return () => abort.abort();
    // Only on mount: the fields are uncontrolled after that
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKeyDown(e) {
    // Any typing after a "pop" brings the caret back
    if (idle && e.key.length === 1) setIdle(false);

    // Ctrl/⌘+Enter is the auto-type shortcut, handled by App
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();

    if (e.target === questionRef.current) {
      if (questionRef.current.textContent.trim()) focusEnd(answerRef.current);
    } else if (answerRef.current.textContent.trim()) {
      pop();
    }
  }

  return (
    <motion.div
      className={`sticker${shadow ? " shadow" : ""}${idle ? " idle" : ""}`}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.25, ease: "easeIn" } }}
      transition={{ type: "spring", stiffness: 380, damping: 18 }}
    >
      <motion.div animate={controls} onKeyDown={handleKeyDown}>
        <div
          className="avatar"
          style={{ backgroundImage: avatar ? `url(${avatar})` : undefined }}
        />
        <div className="header" style={{ background: header }}>
          <div
            ref={questionRef}
            id="question"
            className="field"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            data-placeholder="Ask me a question"
            onInput={(e) => {
              tidy(e.currentTarget);
              onQuestionChange(e.currentTarget.textContent);
            }}
            onPaste={pastePlainText}
          />
        </div>
        <div className="body">
          <div
            ref={answerRef}
            id="answer"
            className="field"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            data-placeholder="Type something..."
            onInput={(e) => tidy(e.currentTarget)}
            onPaste={pastePlainText}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
