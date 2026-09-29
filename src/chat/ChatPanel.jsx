import { BackgroundColor, ExportSection, SizeSlider, TypingControls } from "../PanelSections.jsx";

export default function ChatPanel({ settings, update, panelRef, onPlay, onExport, exportStatus }) {
  return (
    <div id="panel" ref={panelRef}>
      <h2>Chat Bubble</h2>

      <BackgroundColor settings={settings} update={update} />
      <SizeSlider settings={settings} update={update} min={0.5} max={3} />

      <label>
        Messages disappear after
        <select value={settings.lifetime} onChange={(e) => update({ lifetime: Number(e.target.value) })}>
          <option value={5}>5 seconds</option>
          <option value={10}>10 seconds (original)</option>
          <option value={20}>20 seconds</option>
          <option value={60}>1 minute</option>
          <option value={0}>Never</option>
        </select>
      </label>

      <div className="section">
        <h3>Auto-type</h3>
        <label>
          Messages (one per line)
          <textarea
            rows={5}
            value={settings.script}
            onChange={(e) => update({ script: e.target.value })}
            placeholder={"hey\nare you free tonight?\nwanna grab dinner 🍜"}
          />
        </label>
        <TypingControls settings={settings} update={update} onPlay={onPlay} />
      </div>

      <ExportSection settings={settings} update={update} onExport={onExport} exportStatus={exportStatus} />

      <div className="help">
        <kbd>Enter</kbd> send message
        <br />
        <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd> play auto-type
        <br />
        <kbd>Esc</kbd> clear all / stop
        <br />
        <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>.</kbd> toggle this panel
      </div>
    </div>
  );
}
