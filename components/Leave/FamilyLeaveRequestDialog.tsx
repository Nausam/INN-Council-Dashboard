"use client";

import { submitFamilyLeaveRequest, updateFamilyLeaveRequest } from "@/lib/actions/family-leave.actions";
import { maldivesDateTime } from "@/lib/dates/maldives";
import { parseLeaveDateRange } from "@/lib/leave/date-range";
import {
  isSalaamKind,
  SALAAM_FAMILY_LEAVE_TYPES,
  type SalaamFamilyLeaveType,
} from "@/lib/leave/salaam-family-types";
import { CertificateFileError, prepareCertificateFile } from "@/lib/leave/certificate-file";
import { isDhivehiText } from "@/lib/leave/dhivehi-text";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, FileBadge, FileText, Loader2, Upload, X } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import styles from "./family-leave-request.module.css";
import motifs from "@/components/employee-portal/portal-motifs.module.css";
import { LeaveRangePreview } from "@/components/employee-portal/LeaveRangePreview";
import { REQUEST_VISUALS } from "@/lib/employees/request-visuals";
import { cn } from "@/lib/utils";

/** A pending request being changed instead of a new one being submitted. */
export type FamilyLeaveEdit = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  /** Certificate Salaam: the certificate already uploaded. */
  certificateUrl?: string;
};

/** The two sick leave forms, picked with tabs on the Salaam form. */
const SALAAM_TABS = SALAAM_FAMILY_LEAVE_TYPES.filter((type) => isSalaamKind(type.value));

const CERTIFICATE_ERRORS = {
  type: "ސެޓިފިކެޓުގެ ފޮޓޯއެއް ނުވަތަ PDF އެއް ހޮވާ.",
  size: "ފައިލް 10MB އަށްވުރެ ބޮޑު. ކުޑަ ފައިލެއް ހޮވާ.",
  missing: "ސެޓިފިކެޓް އަޕްލޯޑް ކުރައްވާ.",
} as const;

function fileSizeLabel(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FamilyLeaveRequestDialog({
  employeeId,
  presetLeaveType,
  editRequest,
  open,
  onOpenChange,
  onSubmitted,
}: {
  employeeId: string;
  presetLeaveType?: SalaamFamilyLeaveType;
  editRequest?: FamilyLeaveEdit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
}) {
  const editing = Boolean(editRequest);
  const salaamForm = isSalaamKind(presetLeaveType);
  const visual = REQUEST_VISUALS[salaamForm ? "salaam" : "family"];
  const HeaderIcon = visual.icon;
  const [clock, setClock] = useState({ time: "—" });
  const [leaveType, setLeaveType] = useState<SalaamFamilyLeaveType | "">("");
  // Salaam or Certificate Salaam, switched with the tabs; an edit keeps its own.
  const [salaamKind, setSalaamKind] = useState<"salaam" | "certificateSalaam">(
    presetLeaveType === "certificateSalaam" ? "certificateSalaam" : "salaam",
  );
  const effectiveType = salaamForm ? salaamKind : presetLeaveType ?? leaveType;
  const needsCertificate = effectiveType === "certificateSalaam";
  const [certificate, setCertificate] = useState<File | null>(null);
  const [certificatePreview, setCertificatePreview] = useState<string | null>(null);
  const [preparingCertificate, setPreparingCertificate] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function changeOpen(next: boolean) {
    if (pending) return;
    onOpenChange(next);
    if (!next) {
      setSubmitted(false);
      setError("");
      chooseCertificate(null);
    }
  }

  function chooseCertificate(file: File | null) {
    setCertificate(file);
    setCertificatePreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return file?.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    });
  }

  async function handleCertificate(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreparingCertificate(true);
    setError("");
    try {
      chooseCertificate(await prepareCertificateFile(file));
    } catch (cause) {
      setError(CERTIFICATE_ERRORS[cause instanceof CertificateFileError ? cause.reason : "type"]);
    } finally {
      setPreparingCertificate(false);
    }
  }

  useEffect(() => {
    if (!open || !editRequest) return;
    setStartDate(editRequest.startDate);
    setEndDate(editRequest.endDate);
    setReason(editRequest.reason);
    setSubmitted(false);
    setError("");
  }, [open, editRequest]);

  useEffect(() => {
    if (!open || editRequest) return;
    const today = maldivesDateTime();
    setStartDate((current) => current || today.date);
    setEndDate((current) => current || today.date);
    const updateClock = () => setClock({ time: maldivesDateTime().time });
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, [open, editRequest]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!isDhivehiText(reason, 300)) {
      setError("ސަބަބު ދިވެހިން ލިޔުއްވާ.");
      return;
    }
    try {
      parseLeaveDateRange(startDate, endDate);
    } catch {
      setError("ފެށޭ ތާރީޚާއި ނިމޭ ތާރީޚު ރަނގަޅަށް ހޮވާ. 365 ދުވަހަށްވުރެ ދިގު ނުކުރައްވާ.");
      return;
    }
    if (needsCertificate && !editing && !certificate) {
      setError(CERTIFICATE_ERRORS.missing);
      return;
    }
    let certificateForm: FormData | undefined;
    if (needsCertificate && certificate) {
      certificateForm = new FormData();
      certificateForm.set("certificate", certificate);
    }
    setError("");
    setPending(true);
    if (editRequest) {
      try {
        const result = await updateFamilyLeaveRequest({
          employeeId,
          requestId: editRequest.id,
          reason,
          startDate,
          endDate,
        }, certificateForm);
        if (!result.ok) {
          setError(result.code === "certificate_invalid"
            ? CERTIFICATE_ERRORS.type
            : "މި ފޯމު ރިވިއު ކުރެވިފައިވާތީ ބަދަލެއް ނުގެނެވޭނެ.");
          return;
        }
        chooseCertificate(null);
        setSubmitted(true);
        onSubmitted?.();
      } catch {
        setError("ބަދަލުތައް ރައްކާ ނުކުރެވުނު. އަލުން ކޮށްލައްވާ.");
      } finally {
        setPending(false);
      }
      return;
    }
    try {
      const result = await submitFamilyLeaveRequest({
        employeeId,
        leaveType: effectiveType,
        reason,
        startDate,
        endDate,
      }, certificateForm);
      if (!result.ok) {
        setError(result.code === "certificate_required"
          ? CERTIFICATE_ERRORS.missing
          : result.code === "certificate_invalid"
            ? CERTIFICATE_ERRORS.type
            : "މުވައްޒަފުގެ ނަން، އެޑްރެސް އަދި މަގާމް ދިވެހިން އެޑިޓް ފޯމުން ފުރަމަ ޖެހޭ.");
        return;
      }
      setClock({ time: result.reportedTime });
      setSubmitted(true);
      onSubmitted?.();
      setLeaveType("");
      setStartDate("");
      setEndDate("");
      setReason("");
      chooseCertificate(null);
    } catch {
      setError("ފޯމު ފޮނުވަން ނުކުޅުނު. އަލުން ކޮށްލައްވާ.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={changeOpen}
    >
      <DialogContent
        dir="rtl"
        lang="dv"
        className={styles.dialog}
        overlayClassName="bg-black/40"
      >
        <DialogHeader className={styles.header}>
          <div className={styles.headRow}>
          <span className={cn(motifs.glossIcon, styles.headIcon)} data-tone={visual.tone} aria-hidden="true">
            <HeaderIcon />
          </span>
          <DialogTitle className={styles.title}>
            {presetLeaveType
              ? `${SALAAM_FAMILY_LEAVE_TYPES.find((type) => type.value === effectiveType)?.labelDv} ޗުއްޓީ`
              : "ޗުއްޓީ އެދޭ ފޯމު"}
          </DialogTitle>
          </div>
        </DialogHeader>

        {submitted ? (
          <div className={styles.success} role="status">
            <span className={cn(motifs.glossIcon, styles.successIcon)} data-tone="present" aria-hidden="true">
              <Check />
            </span>
            <p>{editing ? "ބަދަލުތައް ރައްކާކުރެވިއްޖެ." : "ފޯމު ފޮނުވުނު."}</p>
            <button type="button" onClick={() => changeOpen(false)}>
              ނިންމާ
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {salaamForm && !editing ? (
              <div className={styles.tabs} role="tablist" aria-label="ސަލާމުގެ ބާވަތް">
                {SALAAM_TABS.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    role="tab"
                    aria-selected={salaamKind === type.value}
                    onClick={() => {
                      setSalaamKind(type.value as "salaam" | "certificateSalaam");
                      setError("");
                    }}
                    className={styles.tab}
                  >
                    {type.labelDv}
                  </button>
                ))}
              </div>
            ) : null}

            {!presetLeaveType ? (
              <div className={styles.field}>
                <label htmlFor="family-leave-type">ޗުއްޓީގެ ބާވަތް</label>
                <select
                  id="family-leave-type"
                  value={leaveType}
                  onChange={(event) => setLeaveType(event.target.value as SalaamFamilyLeaveType | "")}
                  required
                >
                  <option value="" disabled>ބާވަތް ހޮވާ</option>
                  {SALAAM_FAMILY_LEAVE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.labelDv}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className={styles.row}>
              <div className={styles.field}>
                <label htmlFor="family-leave-start-date">ފެށޭ ތާރީޚު</label>
                <input
                  id="family-leave-start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => {
                    const nextStart = event.target.value;
                    setStartDate(nextStart);
                    setEndDate((current) => !current || current < nextStart ? nextStart : current);
                  }}
                  required
                  dir="ltr"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="family-leave-end-date">ނިމޭ ތާރީޚު</label>
                <input
                  id="family-leave-end-date"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                  dir="ltr"
                />
              </div>
            </div>

            <LeaveRangePreview startDate={startDate} endDate={endDate} tone={visual.tone} />

            {!editing ? (
              <div className={styles.field}>
                <label htmlFor="family-leave-time">އެންގި ގަޑި</label>
                <input
                  id="family-leave-time"
                  type="text"
                  value={clock.time}
                  readOnly
                  dir="ltr"
                />
              </div>
            ) : null}

            <div className={styles.field}>
              <label htmlFor="family-leave-reason">ސަބަބު</label>
              <textarea
                id="family-leave-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                minLength={2}
                maxLength={300}
                rows={4}
                dir="rtl"
              />
            </div>

            {needsCertificate ? (
              <div className={styles.field}>
                <label htmlFor="family-leave-certificate">ސެޓިފިކެޓް</label>
                {editRequest?.certificateUrl && !certificate ? (
                  <a href={editRequest.certificateUrl} target="_blank" rel="noreferrer" className={styles.currentCertificate}>
                    <FileBadge aria-hidden="true" /> މިހާރުގެ ސެޓިފިކެޓް ބައްލަވާ
                  </a>
                ) : null}
                {certificate ? (
                  <div className={styles.certificateFile}>
                    {certificatePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen photo
                      <img src={certificatePreview} alt="" className={styles.certificateThumb} />
                    ) : (
                      <span className={cn(motifs.glossIcon, styles.certificateIcon)} data-tone="late" aria-hidden="true">
                        <FileText />
                      </span>
                    )}
                    <span className={styles.certificateName} dir="ltr">
                      <strong>{certificate.name}</strong>
                      <small>{fileSizeLabel(certificate.size)}</small>
                    </span>
                    <button
                      type="button"
                      onClick={() => chooseCertificate(null)}
                      className={styles.certificateRemove}
                      aria-label="ސެޓިފިކެޓް ފުހެލާ"
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <label htmlFor="family-leave-certificate" className={styles.upload} data-busy={preparingCertificate || undefined}>
                    {preparingCertificate ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
                    <span>
                      <strong>{editRequest?.certificateUrl ? "އައު ސެޓިފިކެޓެއް ހޮވާ" : "ސެޓިފިކެޓް ހޮވާ"}</strong>
                      <small>ފޮޓޯ ނުވަތަ PDF</small>
                    </span>
                  </label>
                )}
                <input
                  id="family-leave-certificate"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => void handleCertificate(event)}
                  className="sr-only"
                  disabled={preparingCertificate || pending}
                />
              </div>
            ) : null}

            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <button className={styles.submit} type="submit" disabled={pending || preparingCertificate}>
              {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
              {editing ? "ސޭވް" : "ސަބްމިޓް"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
