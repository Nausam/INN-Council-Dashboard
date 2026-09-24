"use client";

import {
  getPwaInstallPrompt,
  subscribeToPwaInstallPrompt,
  takePwaInstallPrompt,
} from "@/lib/pwa-install";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Download, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./employee-pwa-install.module.css";

type Platform = "android" | "ios";

const DISMISSED_KEY = "employee-pwa-install-dismissed-at";
const INSTALLED_KEY = "employee-pwa-installed";
const REMIND_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

function devicePlatform(): Platform | null {
  const userAgent = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/i.test(userAgent)) return "android";
  return null;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Installation guidance still works when storage is unavailable.
  }
}

export function EmployeePwaInstallPrompt() {
  const installPrompt = useSyncExternalStore(
    subscribeToPwaInstallPrompt,
    getPwaInstallPrompt,
    () => null,
  );
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("android");
  const [currentDevice, setCurrentDevice] = useState<Platform | null>(null);
  const [iosSafari, setIosSafari] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [promptFailed, setPromptFailed] = useState(false);

  useEffect(() => {
    const device = devicePlatform();
    const alreadyInstalled = isStandalone();
    const dismissedAt = Number(readStorage(DISMISSED_KEY));
    const recentlyDismissed = dismissedAt > 0 && Date.now() - dismissedAt < REMIND_AFTER_MS;
    const userAgent = navigator.userAgent;

    setCurrentDevice(device);
    setPlatform(device ?? "android");
    setIosSafari(!/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent));
    setInstalled(alreadyInstalled);
    setReady(true);
    if (device && !alreadyInstalled && readStorage(INSTALLED_KEY) !== "true" && !recentlyDismissed) {
      setOpen(true);
    }

    const onInstalled = () => {
      writeStorage(INSTALLED_KEY, "true");
      setInstalled(true);
      setOpen(false);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  useEffect(() => {
    if (installPrompt) setPromptFailed(false);
  }, [installPrompt]);

  const close = () => {
    setOpen(false);
    writeStorage(DISMISSED_KEY, String(Date.now()));
  };

  const install = async () => {
    const prompt = takePwaInstallPrompt();
    if (!prompt) return;
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        writeStorage(INSTALLED_KEY, "true");
        setInstalled(true);
      }
      close();
    } catch {
      setPromptFailed(true);
    } finally {
      setInstalling(false);
    }
  };

  if (!ready || installed) return null;

  const nativeInstallAvailable = platform === "android" && (Boolean(installPrompt) || installing) && !promptFailed;

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setOpen(true)}>
        <Download size={17} aria-hidden="true" />
        Install the app
        <ArrowUpRight size={15} aria-hidden="true" />
      </button>

      <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (nextOpen) setOpen(true); else close(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.modal}>
            <Dialog.Close className={styles.close} aria-label="Close install guide"><X size={19} /></Dialog.Close>
            <div className={styles.appIcon}>
              <Image src="/pwa/icon-192.png" alt="" width={64} height={64} unoptimized />
            </div>
            <p className={styles.eyebrow}>INNAMAADHOO COUNCIL</p>
            <Dialog.Title className={styles.title}>Install Employee Portal</Dialog.Title>
            <Dialog.Description className={styles.description}>
              Open your portal from your home screen.
            </Dialog.Description>

            <div className={styles.platforms} aria-label="Choose your phone">
              <button type="button" className={platform === "android" ? styles.platformActive : styles.platform} onClick={() => setPlatform("android")} aria-pressed={platform === "android"}>Android</button>
              <button type="button" className={platform === "ios" ? styles.platformActive : styles.platform} onClick={() => setPlatform("ios")} aria-pressed={platform === "ios"}>iPhone / iPad</button>
            </div>

            <div className={styles.guide}>
              {platform === "ios" ? (
                <>
                  {currentDevice === "ios" && !iosSafari ? <p className={styles.notice}>Open this page in Safari first.</p> : null}
                  <div className={styles.step}><span className={styles.stepNumber}>1</span><p>In Safari, tap <strong>Share</strong>.</p></div>
                  <div className={styles.step}><span className={styles.stepNumber}>2</span><p>Tap <strong>Add to Home Screen</strong>.</p></div>
                  <div className={styles.step}><span className={styles.stepNumber}>3</span><p>Turn on <strong>Open as Web App</strong>, then tap <strong>Add</strong>.</p></div>
                </>
              ) : nativeInstallAvailable ? (
                <p className={styles.readyMessage}>Your browser is ready to install the app. Tap the button below.</p>
              ) : (
                <>
                  <div className={styles.step}><span className={styles.stepNumber}>1</span><p>Open this page in your Android browser.</p></div>
                  <div className={styles.step}><span className={styles.stepNumber}>2</span><p>Open the browser menu and tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p></div>
                </>
              )}
            </div>

            <div className={styles.actions}>
              <button type="button" className={styles.later} onClick={close}>Not now</button>
              {nativeInstallAvailable ? (
                <button type="button" className={styles.primary} onClick={() => void install()} disabled={installing}>
                  <Download size={17} aria-hidden="true" /> {installing ? "Opening…" : "Install app"}
                </button>
              ) : (
                <button type="button" className={styles.primary} onClick={close}>Got it</button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
