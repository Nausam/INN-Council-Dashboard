"use client";

import { CouncilDatePicker, CouncilTimePicker } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { useQueryInvalidation } from "@/hooks/queries";
import { savePrayerTimes } from "@/lib/firebase/hr";
import { cn } from "@/lib/utils";
import { Clock, Moon } from "lucide-react";
import React, { useState } from "react";

const PRAYER_FIELDS = [
  { key: "fathisTime", label: "Fajr" },
  { key: "mendhuruTime", label: "Dhuhr" },
  { key: "asuruTime", label: "Asr" },
  { key: "maqribTime", label: "Maghrib" },
  { key: "ishaTime", label: "Isha" },
] as const;

const PrayerTimesForm = () => {
  const { invalidatePrayerTimes } = useQueryInvalidation();
  const [formData, setFormData] = useState({
    date: "",
    fathisTime: "",
    mendhuruTime: "",
    asuruTime: "",
    maqribTime: "",
    ishaTime: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await savePrayerTimes(formData);
      const month = formData.date.slice(0, 7);
      await invalidatePrayerTimes(formData.date, month);
      alert("Prayer times saved successfully.");
    } catch {
      alert("Error saving prayer times. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl space-y-5">
      <h2 className="text-center text-2xl font-black tracking-tight text-slate-900">
        Add prayer times
      </h2>

      <div>
        <label
          htmlFor="prayer-date"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Date
        </label>
        <CouncilDatePicker
          id="prayer-date"
          value={formData.date}
          onChange={(date) => setFormData((prev) => ({ ...prev, date }))}
          placeholder="Select date"
          required
        />
      </div>

      {PRAYER_FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label
            htmlFor={key}
            className={cn("mb-2 block text-sm font-semibold text-slate-700")}
          >
            {label}
          </label>
          <CouncilTimePicker
            id={key}
            value={formData[key]}
            onChange={(time) =>
              setFormData((prev) => ({ ...prev, [key]: time }))
            }
            icon={key === "fathisTime" || key === "ishaTime" ? Moon : Clock}
            placeholder={`Set ${label.toLowerCase()} time`}
          />
        </div>
      ))}

      <Button type="submit" variant="council" className="h-11 w-full rounded-xl">
        Save prayer times
      </Button>
    </form>
  );
};

export default PrayerTimesForm;
