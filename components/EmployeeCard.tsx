"use client";

import {
  AvatarGlow,
  CouncilCard,
  CouncilCardFooter,
  IconButton,
  SectionBadge,
} from "@/components/design-system";
import { useUser } from "@/Providers/UserProvider";
import { typography } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { Edit3 } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

interface EmployeeCardProps {
  name: string;
  designation: string;
  section?: string;
  employeeId: string;
  onClick: () => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({
  name,
  designation,
  section,
  employeeId,
  onClick,
}) => {
  const router = useRouter();
  const { isAdmin } = useUser();

  const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    router.push(`/employees/${employeeId}/edit`);
  };

  return (
    <CouncilCard onClick={onClick} interactive="hover">
      <div className="relative mb-5 flex items-start justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <AvatarGlow name={name} size="md" />
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                typography.heading,
                "mb-1 truncate transition-colors duration-200 group-hover:text-teal-600",
              )}
            >
              {name}
            </h3>
            <p className={cn(typography.body, "truncate")}>{designation}</p>
          </div>
        </div>

        {isAdmin && (
          <IconButton
            icon={Edit3}
            label="Edit employee"
            onClick={handleEditClick}
          />
        )}
      </div>

      {section && (
        <div className="mb-4">
          <SectionBadge section={section} />
        </div>
      )}

      <CouncilCardFooter label="View Profile" />
    </CouncilCard>
  );
};

export default EmployeeCard;
