export type PwaInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let pendingPrompt: PwaInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

export function getPwaInstallPrompt() {
  return pendingPrompt;
}

export function subscribeToPwaInstallPrompt(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => { subscribers.delete(subscriber); };
}

export function takePwaInstallPrompt() {
  const prompt = pendingPrompt;
  pendingPrompt = null;
  notifySubscribers();
  return prompt;
}

export function capturePwaInstallPrompt() {
  const onBeforeInstallPrompt = (event: Event) => {
    if (window.location.pathname.replace(/\/$/, "") !== "/employees/details") return;
    event.preventDefault();
    pendingPrompt = event as PwaInstallPromptEvent;
    notifySubscribers();
  };
  const onAppInstalled = () => {
    pendingPrompt = null;
    notifySubscribers();
  };

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);

  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onAppInstalled);
  };
}
