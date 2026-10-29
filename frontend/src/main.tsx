import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app";
import { env } from "@/config/env";
import { startTelemetry } from "@/lib/telemetry/telemetry";
import "@/globals.css";
import "@/i18n";

async function prepareApp() {
  if (import.meta.env.DEV && env.VITE_API_MODE === "mock") {
    const { worker } = await import("@/mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" }).catch((error: unknown) => {
      console.error("Mock API could not start; rendering the application anyway.", error);
    });
  }

  const root = document.getElementById("root");
  if (root === null) {
    throw new Error("index.html has no #root element.");
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void startTelemetry();
prepareApp();
