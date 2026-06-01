"use client";

import { AvatarGlow } from "@/components/design-system";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserProfileSkeleton from "@/components/skeletons/SkeletonUserProfile";
import { useCurrentUser } from "@/hooks/getCurrentUser";
import { signOutUser } from "@/lib/actions/user.actions";
import { sidebar, typography } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { LogOut, MoreHorizontal } from "lucide-react";

import { useCouncilSidebar } from "./sidebar-context";

export function CouncilSidebarUser() {
  const { collapsed, isMobile } = useCouncilSidebar();
  const { currentUser, loading } = useCurrentUser();
  const iconOnly = collapsed && !isMobile;

  if (loading) return <UserProfileSkeleton />;

  if (!currentUser) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            sidebar.userCard,
            iconOnly && sidebar.userCardIconOnly,
          )}
        >
          <AvatarGlow name={currentUser.fullName} size="sm" />
          <div
            className="council-sidebar-reveal min-w-0 flex-1"
            data-hidden={iconOnly ? "true" : "false"}
            aria-hidden={iconOnly}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className={cn(typography.sidebarTitle, "text-[13px]")}>
                  {currentUser.fullName}
                </p>
                <p className={cn(typography.body, "truncate text-[11px] font-medium")}>
                  {currentUser.email}
                </p>
              </div>
              <MoreHorizontal className="h-4 w-4 shrink-0 text-slate-400 transition-colors duration-200 group-hover:text-teal-600" />
            </div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isMobile ? "top" : "right"}
        align="end"
        className="w-56 rounded-xl border-slate-200/80 shadow-card"
      >
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <span className={typography.sidebarTitle}>
              {currentUser.fullName}
            </span>
            <span className={cn(typography.body, "text-[11px] font-medium")}>
              {currentUser.email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer rounded-lg focus:bg-teal-50 focus:text-teal-900"
          onClick={async () => {
            try {
              await signOutUser();
              window.location.href = "/sign-in";
            } catch (error) {
              console.error("Error during sign-out:", error);
            }
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
