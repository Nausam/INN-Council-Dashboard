"use client";

import {
  AvatarGlow,
  CouncilCard,
  IconButton,
  SectionBadge,
} from "@/components/design-system";
import { useUser } from "@/Providers/UserProvider";
import { typography } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { CalendarDays, Edit3, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

interface EmployeeCardProps {
  name: string;
  designation: string;
  section?: string;
  employeeId: string;
  onClick: () => void;
  onEditClick?: () => void;
  onDeleteClick?: () => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({
  name,
  designation,
  section,
  employeeId,
  onClick,
  onEditClick,
  onDeleteClick,
}) => {
  const { isAdmin } = useUser();
  const router = useRouter();

  const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onEditClick?.();
  };

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDeleteClick?.();
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    router.push(`/employees/details/${employeeId}`);
  };

  return (
    <CouncilCard
      onClick={handleCardClick}
      interactive="hover"
      className="rounded-lg border-slate-200 bg-white p-4 shadow-sm hover:border-teal-200"
    >
      <div className="relative mb-5 flex items-start justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <AvatarGlow name={name} size="md" className="rounded-lg" />
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                typography.heading,
                "mb-1 truncate text-slate-950 transition-colors duration-200 group-hover:text-teal-700",
              )}
            >
              {name}
            </h3>
            <p className={cn(typography.body, "truncate font-bold")}>{designation}</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex shrink-0 items-center gap-1.5">
            <IconButton
              icon={Edit3}
              label="Edit employee"
              onClick={handleEditClick}
            />
            <IconButton
              icon={Trash2}
              label="Delete employee"
              variant="danger"
              onClick={handleDeleteClick}
            />
          </div>
        )}
      </div>

      {section && (
        <div className="mb-4">
          <SectionBadge section={section} className="rounded-lg" />
        </div>
      )}

      <div className="space-y-2">
        <Link
          href={`/employees/details/${employeeId}`}
          onClick={(event) => event.stopPropagation()}
          className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2.5 text-teal-800 ring-1 ring-teal-100 transition hover:bg-teal-100"
        >
          <span className={cn(typography.caption, "text-teal-800")}>
            View Profile
          </span>
          <UserRound className="h-4 w-4 text-teal-700" />
        </Link>
        <Link
          href={`/employees/${employeeId}/leaves`}
          onClick={(event) => event.stopPropagation()}
          className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2.5 text-orange-800 ring-1 ring-orange-100 transition hover:bg-orange-100"
        >
          <span className={cn(typography.caption, "text-orange-800")}>
            Leave Calendar
          </span>
          <CalendarDays className="h-4 w-4 text-orange-600" />
        </Link>
      </div>
    </CouncilCard>
  );
};

export default EmployeeCard;
