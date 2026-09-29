// Settings panel controls shared by the sticker and chat pages
import { SIZES } from "./useSettings.js";

export function BackgroundColor({ settings, update }) {
  return (
    <label>
      Background (green screen)
      <div className="row">
        <input type="color" value={settings.screen} onChange={(e) => update({ screen: e.target.value })} />
        <span>{settings.screen}</span>
      </div>
    </label>
  );
}

export function SizeSlider({ settings, update, min = 0.6, max = 2.5 }) {
  return (
    <label>
      Size
      <input
        type="range"
        min={min}
        max={max}
        step="0.05"
        value={settings.scale}
        onChange={(e) => update({ scale: Number(e.target.value) })}
      />
    </label>
  );
}

// Speed, typos and the Play button, below the page's own text fields
export function TypingControls({ settings, update, onPlay }) {
  return (
    <>
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
        <input type="checkbox" checked={settings.typos} onChange={(e) => update({ typos: e.target.checked })} />
        Occasional typos (fixed with backspace)
      </label>
      <button className="primary" onClick={onPlay}>
        ▶ Play
      </button>
    </>
  );
}

function exportLabel(status) {
  if (status.error) return <span className="error">{status.error}</span>;
  if (status.done) return "Saved to your Downloads.";
  return `Rendering… ${Math.round(status.progress * 100)}%`;
}

export function ExportSection({ settings, update, onExport, exportStatus }) {
  const exporting = exportStatus && "progress" in exportStatus;
  return (
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
        <select value={settings.exportFps} onChange={(e) => update({ exportFps: Number(e.target.value) })}>
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
  );
}
