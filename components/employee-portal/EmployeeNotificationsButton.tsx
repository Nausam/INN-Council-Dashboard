"use client";

import { useToast } from "@/hooks/use-toast";
import {
  employeePushEnabled,
  employeePushSupported,
  enableEmployeePush,
  syncEmployeePush,
} from "@/lib/employee-push";
import { BellPlus, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import headerStyles from "./EmployeePortalHeader.module.css";

/**
 * Header button for the signed-in employee to turn on phone notifications.
 * Hidden once they are on, where the phone can't get them (an iPhone outside
 * the installed app), or after the employee said no.
 */
export function EmployeeNotificationsButton({ employeeId }: { employeeId: string }) {
  const { toast } = useToast();
  const [state, setState] = useState<"hidden" | "off" | "busy">("hidden");

  useEffect(() => {
    if (!employeePushSupported() || Notification.permission === "denied") return;
    let active = true;
    void employeePushEnabled()
      .then((enabled) => {
        if (!active) return;
        if (enabled) void syncEmployeePush(employeeId).catch(() => undefined);
        else setState("off");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [employeeId]);

  if (state === "hidden") return null;

  const turnOn = async () => {
    setState("busy");
    try {
      const permission = await enableEmployeePush(employeeId);
      if (permission === "granted") {
        setState("hidden");
        toast({ title: "Notifications on", description: "HR reminders will now come to this phone." });
      } else {
        setState(permission === "denied" ? "hidden" : "off");
      }
    } catch {
      setState("off");
      toast({
        variant: "destructive",
        title: "Couldn't turn on notifications",
        description: "Check your connection and try again.",
      });
    }
  };

  return (
    <button
      type="button"
      onClick={() => void turnOn()}
      disabled={state === "busy"}
      className={headerStyles.actionButton}
      aria-label="Turn on notifications"
    >
      {state === "busy" ? <Loader2 className="animate-spin" /> : <BellPlus />}
      <span>Turn on alerts</span>
    </button>
  );
}
