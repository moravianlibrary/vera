import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app";
import { env } from "@/config/env";
import "@/globals.css";

async function prepareApp() {
  if (import.meta.env.DEV && env.VITE_API_MODE === "mock") {
    const { worker } = await import("@/mocks/browser");
    await worker.start({ onUnhandledRequest: "bypass" }).catch((error: unknown) => {
      console.error("Mock API could not start; rendering the application anyway.", error);
    });
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

prepareApp();
