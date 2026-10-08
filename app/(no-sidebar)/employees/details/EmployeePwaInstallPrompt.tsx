"use client";

import {
  getPwaInstallPrompt,
  subscribeToPwaInstallPrompt,
  takePwaInstallPrompt,
} from "@/lib/pwa-install";
import { isStandaloneApp } from "@/lib/employee-profile-pwa";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";
import styles from "./employee-pwa-install.module.css";

function isIos() {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
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
  const [ios, setIos] = useState(false);
  const [iosSafari, setIosSafari] = useState(true);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneApp());
    setIos(isIos());
    setIosSafari(!/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent));
    setReady(true);
    const onInstalled = () => { setInstalled(true); setOpen(false); };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  const download = async () => {
    if (ios || !installPrompt) {
      setOpen(true);
      return;
    }
    const prompt = takePwaInstallPrompt();
    if (!prompt) {
      setOpen(true);
      return;
    }
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      else setOpen(false);
    } catch {
      setOpen(true);
    } finally {
      setInstalling(false);
    }
  };

  if (!ready || installed) return null;

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => void download()} disabled={installing}>
        <Download size={17} aria-hidden="true" />
        {installing ? "Opening download…" : "Download Employee Profile"}
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.modal}>
            <Dialog.Close className={styles.close} aria-label="Close"><X size={19} /></Dialog.Close>
            <div className={styles.appIcon}>
              <Image src="/pwa/icon-v2-192.png" alt="" width={64} height={64} unoptimized />
            </div>
            <Dialog.Title className={styles.title}>
              {ios ? "Add Employee Profile" : "Install Employee Profile"}
            </Dialog.Title>
            <Dialog.Description className={styles.description}>
              {ios
                ? "iPhone and iPad require you to add web apps from Safari."
                : "The browser install prompt is not available yet. You can install from your browser menu."}
            </Dialog.Description>
            {ios ? (
              <div className={styles.guide}>
                {!iosSafari ? <p className={styles.notice}>Open this page in Safari first.</p> : null}
                <p>In Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</p>
                <p>Turn on <strong>Open as Web App</strong>, then tap <strong>Add</strong>.</p>
              </div>
            ) : (
              <div className={styles.guide}>
                <p>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
              </div>
            )}
            <button type="button" className={styles.primary} onClick={() => setOpen(false)}>Done</button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
