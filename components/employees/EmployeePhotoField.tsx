"use client";

import { AvatarGlow } from "@/components/design-system";
import { prepareEmployeePhoto } from "@/lib/employees/photo-resize";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** What should happen to the photo when the form is saved. */
export type EmployeePhotoChange =
  | { kind: "keep" }
  | { kind: "replace"; blob: Blob; previewUrl: string }
  | { kind: "remove" };

export function EmployeePhotoField({
  name,
  currentUrl,
  value,
  onChange,
  disabled,
}: {
  name: string;
  currentUrl?: string;
  value: EmployeePhotoChange;
  onChange: (change: EmployeePhotoChange) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const previewUrl =
    value.kind === "replace" ? value.previewUrl : value.kind === "remove" ? undefined : currentUrl;
  const hasPhoto = Boolean(previewUrl);

  // Release the local preview once it's replaced or the form goes away.
  useEffect(() => {
    if (value.kind !== "replace") return;
    return () => URL.revokeObjectURL(value.previewUrl);
  }, [value]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setProcessing(true);
    try {
      const blob = await prepareEmployeePhoto(file);
      onChange({ kind: "replace", blob, previewUrl: URL.createObjectURL(blob) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not use this photo");
    } finally {
      setProcessing(false);
    }
  }

  function removePhoto() {
    setError("");
    // With nothing stored, dropping an unsaved pick simply leaves no photo.
    onChange(currentUrl ? { kind: "remove" } : { kind: "keep" });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative w-fit">
        <AvatarGlow
          name={name || "?"}
          src={previewUrl}
          className="h-24 w-24 rounded-3xl text-3xl"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || processing}
          aria-label={hasPhoto ? "Change photo" : "Upload photo"}
          className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-md transition hover:scale-105 disabled:opacity-60"
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </button>
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700">Profile photo</p>
        <p className="mt-0.5 text-xs font-medium text-slate-500">
          {value.kind === "replace"
            ? "New photo will be saved with the form."
            : value.kind === "remove"
              ? "Photo will be removed when you save."
              : "JPG, PNG or WebP. It's cropped to a square."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || processing}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Upload className="h-3.5 w-3.5" />
            {hasPhoto ? "Change photo" : "Upload photo"}
          </button>
          {hasPhoto ? (
            <button
              type="button"
              onClick={removePhoto}
              disabled={disabled || processing}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          ) : value.kind === "remove" ? (
            <button
              type="button"
              onClick={() => onChange({ kind: "keep" })}
              disabled={disabled}
              className="inline-flex h-9 items-center rounded-xl px-3 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Undo
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-2 text-xs font-medium text-rose-600" role="alert">{error}</p> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
