import { useEffect, useState } from "react";

export const HEADERS = [
  "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
  "linear-gradient(45deg, #833ab4, #fd1d1d, #fcb045)",
  "linear-gradient(135deg, #4f5bd5, #962fbf)",
  "#262626",
  "#3897f0",
  "#8a3ab9",
  "#ed4956",
  "#fd8d32",
  "#58c322",
];

const STORAGE_KEY = "ig-question-bubble";

const DEFAULTS = {
  header: HEADERS[0],
  avatar: "",
  screen: "#04f404",
  scale: 1.3,
  shadow: false,
  keepQuestion: true,
  question: "",
  autoQuestion: "",
  autoAnswer: "",
  wpm: 60,
  typos: false,
};

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

// Settings persisted in localStorage so they survive reloads between recordings
export function useSettings() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS, ...load() }));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage unavailable (e.g. private window) */
    }
  }, [settings]);

  const update = (patch) => setSettings((prev) => ({ ...prev, ...patch }));

  return [settings, update];
}
