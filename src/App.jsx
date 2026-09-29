import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Sticker from "./Sticker.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import { useSettings } from "./useSettings.js";

export default function App() {
  const [settings, update] = useSettings();
  const [stickerId, setStickerId] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [script, setScript] = useState(null);
  const panelRef = useRef(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const playbackRef = useRef(null);

  function stopPlayback() {
    playbackRef.current?.abort();
  }

  // Start a fresh sticker that types the saved question and answer by itself
  function play() {
    const { autoQuestion, autoAnswer, wpm, typos } = settingsRef.current;
    if (!autoQuestion.trim() && !autoAnswer.trim()) return;
    stopPlayback();
    playbackRef.current = new AbortController();
    setScript({
      question: autoQuestion,
      answer: autoAnswer,
      wpm,
      typos,
      signal: playbackRef.current.signal,
    });
    setStickerId((id) => id + 1);
    setPanelOpen(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => setHintVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "." || e.code === "Period")) {
        e.preventDefault();
        stopPlayback(); // don't keep typing while settings are being edited
        setPanelOpen((open) => !open);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        play();
        return;
      }
      if (panelRef.current?.contains(e.target)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        stopPlayback();
        setScript(null);
        setStickerId((id) => id + 1);
      }
    }

    // Keep focus inside the sticker so recording never loses the caret
    function handleMouseDown(e) {
      if (!panelRef.current?.contains(e.target) && !e.target.closest(".sticker")) {
        e.preventDefault();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleMouseDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  return (
    <main
      className={panelOpen ? "show-cursor" : ""}
      style={{ "--screen": settings.screen, "--scale": settings.scale }}
    >
      <div id="stage">
        <AnimatePresence mode="wait">
          <Sticker
            key={stickerId}
            header={settings.header}
            avatar={settings.avatar}
            shadow={settings.shadow}
            initialQuestion={settings.keepQuestion ? settings.question : ""}
            onQuestionChange={(question) => update({ question })}
            script={script}
          />
        </AnimatePresence>
      </div>

      {panelOpen && (
        <SettingsPanel settings={settings} update={update} panelRef={panelRef} onPlay={play} />
      )}

      <div id="hint" className={hintVisible ? "" : "gone"}>
        Press Ctrl/⌘ + . for settings
      </div>
    </main>
  );
}
