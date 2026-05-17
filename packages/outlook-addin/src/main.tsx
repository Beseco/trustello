import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import { App } from "./App";

// Office.js muss vollständig geladen sein bevor die React-App gestartet wird
Office.onReady(() => {
  const root = document.getElementById("root");
  if (!root) throw new Error("Root element not found");

  createRoot(root).render(
    <StrictMode>
      <FluentProvider theme={webLightTheme} style={{ height: "100%", fontFamily: "inherit" }}>
        <App />
      </FluentProvider>
    </StrictMode>,
  );
});
