import { useRef } from "react";
import { HEADERS, SIZES } from "./useSettings.js";

// Crop to a square and downscale so the photo fits in localStorage
function readAvatar(file, onDone) {
  const img = new Image();
  img.onload = () => {
    const size = 160;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const s = Math.min(img.width, img.height);
    canvas
      .getContext("2d")
      .drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    URL.revokeObjectURL(img.src);
    onDone(canvas.toDataURL("image/jpeg", 0.9));
  };
  img.src = URL.createObjectURL(file);
}

function exportLabel(status) {
  if (!status) return null;
  if (status.error) return <span className="error">{status.error}</span>;
  if (status.done) return "Saved to your Downloads.";
  return `Rendering… ${Math.round(status.progress * 100)}%`;
}

export default function SettingsPanel({ settings, update, panelRef, onPlay, onExport, exportStatus }) {
  const fileRef = useRef(null);
  const exporting = exportStatus && "progress" in exportStatus;

  return (
    <div id="panel" ref={panelRef}>
      <h2>IG Question Bubble</h2>

      <label>
        Header color
        <div className="swatches">
          {HEADERS.map((value) => (
            <div
              key={value}
              className={`swatch${settings.header === value ? " active" : ""}`}
              style={{ background: value }}
              onClick={() => update({ header: value })}
            />
          ))}
        </div>
      </label>

      <label>
        Avatar
        <div className="row">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) readAvatar(file, (avatar) => update({ avatar }));
            }}
          />
          <button onClick={() => fileRef.current.click()}>Upload photo</button>
          <button onClick={() => update({ avatar: "" })}>Clear</button>
        </div>
      </label>

      <label>
        Background (green screen)
        <div className="row">
          <input
            type="color"
            value={settings.screen}
            onChange={(e) => update({ screen: e.target.value })}
          />
          <span>{settings.screen}</span>
        </div>
      </label>

      <label>
        Size
        <input
          type="range"
          min="0.6"
          max="2.5"
          step="0.05"
          value={settings.scale}
          onChange={(e) => update({ scale: Number(e.target.value) })}
        />
      </label>

      <label className="row">
        <input
          type="checkbox"
          checked={settings.shadow}
          onChange={(e) => update({ shadow: e.target.checked })}
        />
        Drop shadow
      </label>
      <label className="row">
        <input
          type="checkbox"
          checked={settings.keepQuestion}
          onChange={(e) => update({ keepQuestion: e.target.checked })}
        />
        Keep question on reset
      </label>

      <div className="section">
        <h3>Auto-type</h3>
        <label>
          Question
          <textarea
            rows={2}
            value={settings.autoQuestion}
            onChange={(e) => update({ autoQuestion: e.target.value })}
            placeholder="What's your favorite snack?"
          />
        </label>
        <label>
          Answer
          <textarea
            rows={3}
            value={settings.autoAnswer}
            onChange={(e) => update({ autoAnswer: e.target.value })}
            placeholder="Mango sticky rice, no contest"
          />
        </label>
        <label>
          Speed: {settings.wpm} WPM
          <input
            type="range"
            min="20"
            max="140"
            step="5"
            value={settings.wpm}
            onChange={(e) => update({ wpm: Number(e.target.value) })}
          />
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={settings.typos}
            onChange={(e) => update({ typos: e.target.checked })}
          />
          Occasional typos (fixed with backspace)
        </label>
        <button className="primary" onClick={onPlay}>
          ▶ Play
        </button>
      </div>

      <div className="section">
        <h3>Export video</h3>
        <label>
          Size
          <select value={settings.exportSize} onChange={(e) => update({ exportSize: e.target.value })}>
            {Object.entries(SIZES).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Frame rate
          <select
            value={settings.exportFps}
            onChange={(e) => update({ exportFps: Number(e.target.value) })}
          >
            <option value={30}>30 fps</option>
            <option value={60}>60 fps</option>
          </select>
        </label>
        <label>
          Background
          <select
            value={settings.exportTransparent ? "transparent" : "screen"}
            onChange={(e) => update({ exportTransparent: e.target.value === "transparent" })}
          >
            <option value="screen">Background color (MP4)</option>
            <option value="transparent">Transparent (WebM)</option>
          </select>
        </label>
        <button className="primary" onClick={onExport} disabled={exporting}>
          ⬇ Export video
        </button>
        {exportStatus && <div className="status">{exportLabel(exportStatus)}</div>}
        <div className="note">Renders the Auto-type text. After ▶ Play, it exports that same take.</div>
      </div>

      <div className="help">
        <kbd>Enter</kbd> question → answer
        <br />
        <kbd>Enter</kbd> on answer → pop
        <br />
        <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Enter</kbd> play auto-type
        <br />
        <kbd>Esc</kbd> new sticker / stop
        <br />
        <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
        <br />
        <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>.</kbd> toggle this panel
      </div>
    </div>
  );
}
