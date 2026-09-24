"use client";

import { capturePwaInstallPrompt } from "@/lib/pwa-install";
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    const stopInstallCapture = capturePwaInstallPrompt();
    if ("serviceWorker" in navigator && window.isSecureContext) {
      const register = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // The site remains usable when service workers are unavailable.
        });
      };

      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });

      return () => {
        window.removeEventListener("load", register);
        stopInstallCapture();
      };
    }

    return stopInstallCapture;
  }, []);

  return null;
}
