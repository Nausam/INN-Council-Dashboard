"use client";

import {
  EMPLOYEE_PROFILE_HOME,
} from "@/lib/employee-profile-pwa";
import {
  beginEmployeeProfileSignIn,
  completeEmployeeProfilePinSetup,
  currentEmployeeProfileIdentity,
  forgetEmployeeProfileIdentity,
  signInEmployeeProfileWithPin,
} from "@/lib/actions/employee-profile.actions";
import motifs from "@/components/employee-portal/portal-motifs.module.css";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  Clock3,
  Delete,
  IdCard,
  KeyRound,
  Loader2,
  ShieldCheck,
  TreePalm,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { EmployeePwaInstallPrompt } from "./EmployeePwaInstallPrompt";
import styles from "./employee-login.module.css";

const PIN_LENGTH = 4;
const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

type Step = "identifier" | "setup" | "pin";
type Status = "idle" | "checking" | "opening";

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export default function EmployeeDetailsLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [step, setStep] = useState<Step>("identifier");
  // First-time setup asks for the PIN twice, one step at a time.
  const [setupStage, setSetupStage] = useState<"create" | "confirm">("create");
  const [identityLoading, setIdentityLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    void currentEmployeeProfileIdentity()
      .then((employeeId) => {
        if (employeeId) setStep("pin");
      })
      .catch(() => {
        // Keep identifier entry available if the remembered identity cannot be read.
      })
      .finally(() => setIdentityLoading(false));
  }, []);

  const busy = status !== "idle";
  const confirming = step === "setup" && setupStage === "confirm";
  const activeDigits = confirming ? pinConfirmation : pin;

  const openProfile = useCallback((employeeId: string) => {
    // Stay in the "opening" state until the profile page replaces this one.
    setStatus("opening");
    router.push(`${EMPLOYEE_PROFILE_HOME}/${employeeId}`);
  }, [router]);

  const failPin = useCallback((message: string) => {
    setError(message);
    setShakeKey((value) => value + 1);
    setPin("");
    setPinConfirmation("");
    setSetupStage("create");
    setStatus("idle");
  }, []);

  const submitPin = useCallback(async (value: string) => {
    setStatus("checking");
    try {
      openProfile(await signInEmployeeProfileWithPin(value));
    } catch (cause) {
      failPin(errorMessage(cause, "That PIN didn't work. Try again."));
    }
  }, [failPin, openProfile]);

  const submitSetup = useCallback(async (created: string, confirmed: string) => {
    if (created !== confirmed) {
      failPin("The PINs didn't match. Create your PIN again.");
      return;
    }
    setStatus("checking");
    try {
      openProfile(await completeEmployeeProfilePinSetup(created, confirmed));
    } catch (cause) {
      failPin(errorMessage(cause, "Could not save your PIN. Try again."));
    }
  }, [failPin, openProfile]);

  const pressDigit = useCallback((digit: string) => {
    if (busy || activeDigits.length >= PIN_LENGTH) return;
    setError("");
    const next = activeDigits + digit;
    if (confirming) {
      setPinConfirmation(next);
      if (next.length === PIN_LENGTH) void submitSetup(pin, next);
      return;
    }
    setPin(next);
    if (next.length < PIN_LENGTH) return;
    if (step === "pin") void submitPin(next);
    else window.setTimeout(() => setSetupStage("confirm"), 220);
  }, [activeDigits, busy, confirming, pin, step, submitPin, submitSetup]);

  const deleteDigit = useCallback(() => {
    if (busy) return;
    if (confirming) setPinConfirmation((value) => value.slice(0, -1));
    else setPin((value) => value.slice(0, -1));
  }, [busy, confirming]);

  // Physical keyboards can type the PIN too.
  useEffect(() => {
    if (step === "identifier" || identityLoading) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^\d$/.test(event.key)) pressDigit(event.key);
      else if (event.key === "Backspace") deleteDigit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteDigit, identityLoading, pressDigit, step]);

  const handleIdentifierSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (!identifier.trim()) {
      setError("Enter your ID or record card number.");
      return;
    }
    setError("");
    setStatus("checking");
    try {
      const result = await beginEmployeeProfileSignIn(identifier);
      setStep(result.requiresSetup ? "setup" : "pin");
      setSetupStage("create");
      setPin("");
      setPinConfirmation("");
    } catch (cause) {
      setError(errorMessage(cause, "Could not find that number."));
    } finally {
      setStatus("idle");
    }
  };

  const changeNumber = async () => {
    setStatus("checking");
    try {
      await forgetEmployeeProfileIdentity();
      setStep("identifier");
      setPin("");
      setPinConfirmation("");
      setError("");
    } catch {
      setError("Could not change employee. Try again.");
    } finally {
      setStatus("idle");
    }
  };

  const pinTitle = step === "setup"
    ? confirming ? "Confirm your PIN" : "Create your PIN"
    : "Enter your PIN";
  const pinHelper = step === "setup"
    ? confirming
      ? "Type the same four digits again."
      : "This is your first sign-in. Choose four digits you'll remember."
    : "Enter the four-digit PIN you set for this profile.";

  return (
    <div className={styles.page} data-step={identityLoading ? "loading" : step}>
      <div className={styles.shell}>
        <div className={styles.brand}>
          <Image
            src="/council-logo-full.png"
            alt="Raa Innamaadhoo Council"
            width={900}
            height={819}
            className={styles.brandLogo}
            unoptimized
            priority
          />
        </div>

        <section className={styles.panel} aria-labelledby="employee-portal-title" aria-busy={identityLoading || busy}>
          {identityLoading ? (
            <div className={styles.skeleton} aria-label="Opening sign-in">
              <span className={cn(styles.skelBlock, styles.skelIcon)} />
              <span className={cn(styles.skelBlock, styles.skelTitle)} />
              <span className={cn(styles.skelBlock, styles.skelLine)} />
              <span className={cn(styles.skelBlock, styles.skelInput)} />
              <span className={cn(styles.skelBlock, styles.skelButton)} />
            </div>
          ) : status === "opening" ? (
            <div className={styles.opening} role="status">
              <span className={cn(motifs.glossIcon, styles.openingIcon)} data-tone="present">
                <Check />
              </span>
              <h1 id="employee-portal-title">Opening your profile</h1>
              <p>Loading your attendance, leave and pay…</p>
              <span className={styles.openingBar}><span /></span>
            </div>
          ) : step === "identifier" ? (
            <>
              <div className={styles.panelHead}>
                <span className={cn(motifs.glossIcon, styles.headIcon)} data-tone="annual">
                  <IdCard />
                </span>
                <span className={styles.eyebrow}>Staff sign-in</span>
              </div>
              <h1 id="employee-portal-title">Employee Profile</h1>
              <p className={styles.helper}>Use your ID card or record card number to continue.</p>

              <form onSubmit={handleIdentifierSubmit} className={styles.form}>
                <label htmlFor="employee-identifier" className={styles.fieldLabel}>
                  ID card or record card number
                </label>
                <div className={styles.inputWrap}>
                  <IdCard className={styles.inputIcon} aria-hidden="true" />
                  <input
                    id="employee-identifier"
                    value={identifier}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      if (error) setError("");
                    }}
                    placeholder="e.g. A123456 or 88792"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    disabled={busy}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "employee-login-error" : undefined}
                  />
                </div>

                {error ? (
                  <p id="employee-login-error" className={styles.error} role="alert">{error}</p>
                ) : null}

                <button type="submit" disabled={busy} className={styles.submit}>
                  <span>{busy ? "Checking…" : "Continue"}</span>
                  {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className={styles.panelHead}>
                <span className={styles.headStart}>
                  <span
                    className={cn(motifs.glossIcon, styles.headIcon)}
                    data-tone={step === "setup" ? "present" : "annual"}
                  >
                    {step === "setup" ? <ShieldCheck /> : <KeyRound />}
                  </span>
                  {step === "setup" ? (
                    <span className={styles.stepPill}>Step {confirming ? 2 : 1} of 2</span>
                  ) : null}
                </span>
                <button type="button" className={styles.back} onClick={() => void changeNumber()} disabled={busy}>
                  <ArrowLeft aria-hidden="true" /> Change number
                </button>
              </div>
              <h1 id="employee-portal-title">{pinTitle}</h1>
              <p className={styles.helper}>{pinHelper}</p>

              <div
                key={shakeKey}
                className={styles.pinTiles}
                data-state={status === "checking" ? "checking" : error ? "error" : undefined}
                role="img"
                aria-label={`${activeDigits.length} of ${PIN_LENGTH} digits entered`}
              >
                {Array.from({ length: PIN_LENGTH }, (_, index) => {
                  const filled = index < activeDigits.length;
                  return (
                    <span
                      key={index}
                      className={cn(styles.pinTile, filled && motifs.glossIcon)}
                      data-tone={filled ? (confirming ? "present" : "annual") : undefined}
                      data-next={index === activeDigits.length && !busy ? "" : undefined}
                      style={{ animationDelay: `${index * 90}ms` }}
                    >
                      {filled ? <span className={styles.pinDot} /> : null}
                    </span>
                  );
                })}
              </div>

              <p className={styles.pinStatus} aria-live="polite">
                {status === "checking" ? (
                  <><Loader2 className="animate-spin" aria-hidden="true" /> {step === "setup" ? "Saving your PIN…" : "Unlocking…"}</>
                ) : error ? (
                  <span className={styles.pinError} role="alert">{error}</span>
                ) : null}
              </p>

              <div className={styles.keypad}>
                {KEYPAD.map((digit) => (
                  <button key={digit} type="button" onClick={() => pressDigit(digit)} disabled={busy} className={styles.key}>
                    {digit}
                  </button>
                ))}
                <span />
                <button type="button" onClick={() => pressDigit("0")} disabled={busy} className={styles.key}>
                  0
                </button>
                <button
                  type="button"
                  onClick={deleteDigit}
                  disabled={busy || activeDigits.length === 0}
                  className={cn(styles.key, styles.keyGhost)}
                  aria-label="Delete last digit"
                >
                  <Delete />
                </button>
              </div>
            </>
          )}
        </section>

        {step === "identifier" && !identityLoading && status !== "opening" ? (
          <div className={styles.features} aria-label="What you'll find inside">
            <span className={styles.feature}>
              <span className={cn(motifs.glossIcon, styles.featureIcon)} data-tone="present"><Clock3 /></span>
              Attendance
            </span>
            <span className={styles.feature}>
              <span className={cn(motifs.glossIcon, styles.featureIcon)} data-tone="leave"><TreePalm /></span>
              Leave
            </span>
            <span className={styles.feature}>
              <span className={cn(motifs.glossIcon, styles.featureIcon)} data-tone="annual"><Banknote /></span>
              Pay
            </span>
          </div>
        ) : null}

        <EmployeePwaInstallPrompt />
      </div>
    </div>
  );
}
