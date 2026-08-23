import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LottoHistoryChecker from "./LottoHistoryChecker.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LottoHistoryChecker />
  </StrictMode>
);
