import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Sticker from "./Sticker.jsx";
import SettingsPanel from "./SettingsPanel.jsx";
import { useSettings } from "./useSettings.js";
import { newSeed } from "./typing.js";
import { download } from "./download.js";

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

  const lastScriptRef = useRef(null);
  const [exportStatus, setExportStatus] = useState(null); // { progress } | { error }

  // The auto-type script from settings. Reuses the last played seed when nothing
  // changed, so an export matches the preview keystroke for keystroke.
  function currentScript() {
    const { autoQuestion, autoAnswer, wpm, typos } = settingsRef.current;
    if (!autoQuestion.trim() && !autoAnswer.trim()) return null;
    const next = { question: autoQuestion, answer: autoAnswer, wpm, typos };
    const last = lastScriptRef.current;
    const same = last && Object.keys(next).every((k) => last[k] === next[k]);
    return { ...next, seed: same ? last.seed : newSeed() };
  }

  // Start a fresh sticker that types the saved question and answer by itself
  function play() {
    const next = currentScript();
    if (!next) return;
    stopPlayback();
    playbackRef.current = new AbortController();
    // A fresh take each time Play is pressed
    const script = { ...next, seed: newSeed() };
    lastScriptRef.current = script;
    setScript({ ...script, signal: playbackRef.current.signal });
    setStickerId((id) => id + 1);
    setPanelOpen(false);
  }

  async function exportToFile() {
    const script = currentScript();
    if (!script) {
      setExportStatus({ error: "Add a question or answer in Auto-type first." });
      return;
    }
    lastScriptRef.current = script;
    const s = settingsRef.current;
    setExportStatus({ progress: 0 });
    try {
      // Loaded on demand: the encoder is most of the bundle
      const { exportVideo } = await import("./exportVideo.js");
      const { blob, extension } = await exportVideo({
        script,
        settings: s,
        size: s.exportSize,
        fps: s.exportFps,
        transparent: s.exportTransparent,
        onProgress: (progress) => setExportStatus({ progress }),
      });
      download(blob, `ig-question-${Date.now()}${extension}`);
      setExportStatus({ done: true });
    } catch (err) {
      setExportStatus({ error: err.message });
    }
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
        <SettingsPanel
          settings={settings}
          update={update}
          panelRef={panelRef}
          onPlay={play}
          onExport={exportToFile}
          exportStatus={exportStatus}
        />
      )}

      <div id="hint" className={hintVisible ? "" : "gone"}>
        Press Ctrl/⌘ + . for settings
      </div>
    </main>
  );
}
