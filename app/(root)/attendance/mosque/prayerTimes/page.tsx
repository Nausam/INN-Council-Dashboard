"use client";

import React, { useState } from "react";
import PrayerTimesForm from "@/components/PrayerTimesForm";
import PrayerTimesTable from "@/components/PrayerTimesTable";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PrayerTimesPage = () => {
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedMonth(format(date, "yyyy-MM"));
    }
    setIsPopoverOpen(false);
  };

  return (
    <section className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Manage Prayer Times</h1>

      {/* Select Month */}
      <div className="flex items-center gap-4">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">Select Month</p>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border p-2 rounded-md w-full max-w-52 h-12"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">
            Add Prayer Time
          </p>
          <AlertDialog>
            <AlertDialogTrigger className="flex items-center justify-center w-full md:w-60">
              <div className="flex justify-center custom-button w-full h-12  items-center">
                <p>Add Prayer Time</p>
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogDescription>
                  <PrayerTimesForm />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Close</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Prayer Times Form */}

      {/* Prayer Times Table */}
      <div className="mt-10">
        <PrayerTimesTable selectedMonth={selectedMonth} />
      </div>
    </section>
  );
};

export default PrayerTimesPage;
