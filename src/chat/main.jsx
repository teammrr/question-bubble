import React from "react";
import ReactDOM from "react-dom/client";
import ChatApp from "./ChatApp.jsx";
import "./chat.css";
import "../panel.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ChatApp />
  </React.StrictMode>
);
