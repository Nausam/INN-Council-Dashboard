"use client";

import {
  EMPLOYEE_PROFILE_HOME,
  isStandaloneApp,
} from "@/lib/employee-profile-pwa";
import {
  beginEmployeeProfileSignIn,
  completeEmployeeProfilePinSetup,
  currentEmployeeProfileSession,
  signInEmployeeProfileWithPin,
} from "@/lib/actions/employee-profile.actions";
import { ArrowLeft, ArrowRight, IdCard, KeyRound, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { EmployeePwaInstallPrompt } from "./EmployeePwaInstallPrompt";
import styles from "./employee-login.module.css";

export default function EmployeeDetailsLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [step, setStep] = useState<"identifier" | "setup" | "pin">("identifier");
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!isStandaloneApp()) return;
    void currentEmployeeProfileSession()
      .then((employeeId) => {
        if (employeeId) router.replace(`${EMPLOYEE_PROFILE_HOME}/${employeeId}`);
      })
      .catch(() => {
        // Keep the sign-in form available when a saved session cannot be read.
      });
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (step === "identifier") {
        if (!identifier.trim()) {
          setError("Enter your ID or record card number.");
          return;
        }
        const result = await beginEmployeeProfileSignIn(identifier);
        setStep(result.requiresSetup ? "setup" : "pin");
        setPin("");
        setPinConfirmation("");
        return;
      }

      const employeeId = step === "setup"
        ? await completeEmployeeProfilePinSetup(pin, pinConfirmation)
        : await signInEmployeeProfileWithPin(pin);
      router.push(`${EMPLOYEE_PROFILE_HOME}/${employeeId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open Employee Profile.");
    } finally {
      setSubmitting(false);
    }
  };

  const loading = submitting;

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>
            <Image src="/council-logo.png" alt="" width={116} height={65} unoptimized />
          </div>
          <span className={styles.brandName}>Innamaadhoo Council</span>
        </div>

        <section className={styles.panel} aria-labelledby="employee-portal-title">
          {step !== "identifier" ? (
            <button
              type="button"
              className={styles.back}
              onClick={() => {
                setStep("identifier");
                setPin("");
                setPinConfirmation("");
                setError("");
              }}
              disabled={loading}
            >
              <ArrowLeft aria-hidden="true" /> Change number
            </button>
          ) : null}
          <h1 id="employee-portal-title">
            {step === "identifier" ? "Employee Profile" : step === "setup" ? "Create your PIN" : "Enter your PIN"}
          </h1>
          <form onSubmit={handleSubmit} className={styles.form}>
            {step === "identifier" ? (
              <>
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
                    placeholder="Enter your number"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "employee-login-error" : undefined}
                  />
                </div>
              </>
            ) : (
              <>
                <p className={styles.helper}>
                  {step === "setup"
                    ? "This is your first sign-in. Create a four-digit PIN for future access."
                    : "Enter the four-digit PIN you set for this profile."}
                </p>
                <label htmlFor="employee-pin" className={styles.fieldLabel}>
                  {step === "setup" ? "New PIN" : "PIN"}
                </label>
                <div className={styles.inputWrap}>
                  <KeyRound className={styles.inputIcon} aria-hidden="true" />
                  <input
                    id="employee-pin"
                    type="password"
                    value={pin}
                    onChange={(event) => {
                      setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                      if (error) setError("");
                    }}
                    placeholder="Four digits"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    autoComplete={step === "setup" ? "new-password" : "current-password"}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "employee-login-error" : undefined}
                    required
                  />
                </div>
                {step === "setup" ? (
                  <>
                    <label htmlFor="employee-pin-confirmation" className={`${styles.fieldLabel} ${styles.nextLabel}`}>
                      Confirm PIN
                    </label>
                    <div className={styles.inputWrap}>
                      <KeyRound className={styles.inputIcon} aria-hidden="true" />
                      <input
                        id="employee-pin-confirmation"
                        type="password"
                        value={pinConfirmation}
                        onChange={(event) => {
                          setPinConfirmation(event.target.value.replace(/\D/g, "").slice(0, 4));
                          if (error) setError("");
                        }}
                        placeholder="Repeat your PIN"
                        inputMode="numeric"
                        pattern="[0-9]{4}"
                        maxLength={4}
                        autoComplete="new-password"
                        required
                      />
                    </div>
                  </>
                ) : null}
              </>
            )}

            {error ? (
              <p id="employee-login-error" className={styles.error} role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={loading} className={styles.submit}>
              <span>{submitting ? "Please wait…" : step === "setup" ? "Create PIN and continue" : step === "pin" ? "Unlock profile" : "Continue"}</span>
              {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
            </button>
          </form>
        </section>
        <EmployeePwaInstallPrompt />
      </div>
    </div>
  );
}
