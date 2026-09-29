import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ChatPanel from "./ChatPanel.jsx";
import { CHAT_PAUSES } from "./timeline.js";
import { useSettings } from "../useSettings.js";
import { PAUSES, newSeed, planTexts, sleep, typeSteps } from "../typing.js";
import { download } from "../download.js";

const DEFAULTS = {
  screen: "#04f404",
  scale: 1,
  lifetime: 10, // seconds before a sent message fades out; 0 = never
  script: "",
  wpm: 60,
  typos: false,
  exportSize: "story",
  exportFps: 60,
  exportTransparent: false,
};

// One message per line
const toMessages = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

export default function ChatApp() {
  const [settings, update] = useSettings("chat-bubble", DEFAULTS);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [exportStatus, setExportStatus] = useState(null); // { progress } | { error } | { done }
  const currentRef = useRef(null);
  const panelRef = useRef(null);
  const timersRef = useRef(new Set());
  const playbackRef = useRef(null);
  const lastScriptRef = useRef(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    document.documentElement.style.setProperty("--body-bg-color", settings.screen);
  }, [settings.screen]);

  useEffect(() => {
    currentRef.current.focus();
    const timer = setTimeout(() => setHintVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  function send() {
    const el = currentRef.current;
    const text = el.textContent;
    if (text.trim() === "") return;

    const id = Date.now();
    setMessages((prev) => [...prev, { id, text }]);
    el.textContent = "";
    setTyping(false);

    const { lifetime } = settingsRef.current;
    if (lifetime > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setMessages((prev) => prev.filter((msg) => msg.id !== id));
      }, lifetime * 1000);
      timersRef.current.add(timer);
    }
  }

  function stopPlayback() {
    playbackRef.current?.abort();
  }

  function clearAll() {
    stopPlayback();
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
    setMessages([]);
    currentRef.current.textContent = "";
    setTyping(false);
  }

  // The script from settings. Reuses the last played seed when nothing changed,
  // so an export matches the preview keystroke for keystroke.
  function currentScript() {
    const { script, wpm, typos } = settingsRef.current;
    const lines = toMessages(script);
    if (!lines.length) return null;
    const next = { text: lines.join("\n"), wpm, typos };
    const last = lastScriptRef.current;
    const same = last && Object.keys(next).every((key) => last[key] === next[key]);
    return { ...next, messages: lines, seed: same ? last.seed : newSeed() };
  }

  // Type every message by itself, pressing Enter after each one
  async function play() {
    const next = currentScript();
    if (!next) return;
    clearAll();
    setPanelOpen(false);
    const script = { ...next, seed: newSeed() }; // a fresh take each time
    lastScriptRef.current = script;
    const abort = new AbortController();
    playbackRef.current = abort;
    const { signal } = abort;
    const el = currentRef.current;
    const plans = planTexts(script.messages, script);

    try {
      await sleep(PAUSES.start, signal);
      for (let i = 0; i < plans.length; i++) {
        if (i > 0) await sleep(CHAT_PAUSES.afterSend, signal);
        await typeSteps(el, plans[i], signal);
        await sleep(CHAT_PAUSES.beforeSend, signal);
        send();
      }
    } catch {
      /* stopped: Esc, a new run, or the settings panel opened */
    }
  }

  async function exportToFile() {
    const script = currentScript();
    if (!script) {
      setExportStatus({ error: "Add some messages in Auto-type first." });
      return;
    }
    lastScriptRef.current = script;
    const s = settingsRef.current;
    setExportStatus({ progress: 0 });
    try {
      // Loaded on demand: the encoder is most of the bundle
      const { exportChat } = await import("./exportChat.js");
      const { blob, extension } = await exportChat({
        script,
        settings: s,
        size: s.exportSize,
        fps: s.exportFps,
        transparent: s.exportTransparent,
        onProgress: (progress) => setExportStatus({ progress }),
      });
      download(blob, `chat-bubble-${Date.now()}${extension}`);
      setExportStatus({ done: true });
    } catch (err) {
      setExportStatus({ error: err.message });
    }
  }

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
        clearAll();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Handlers read the latest settings through settingsRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKeyDown(e) {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    send();
  }

  // Keep the caret in the message box (except while using the settings panel)
  function handleBlur() {
    setTimeout(() => {
      if (!panelRef.current?.contains(document.activeElement)) currentRef.current?.focus();
    }, 10);
  }

  return (
    <>
      <div id="chat-container" style={{ zoom: settings.scale }}>
        <div id="all-messages">
          <div id="past-messages">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  layout
                  key={message.id}
                  initial={{ y: 40 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15, duration: 0.2 }}
                  className="chat-bubble-container"
                >
                  <div className="chat-bubble-white">{message.text}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div
            id="current-message"
            className={typing ? "current-message-typing" : "current-message-not-typing"}
            ref={currentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => setTyping(true)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        </div>
      </div>

      {panelOpen && (
        <ChatPanel
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
    </>
  );
}
