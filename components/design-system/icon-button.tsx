import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";

const iconButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-xl border shadow-sm transition-[color,background-color,border-color,transform,box-shadow] duration-200 active:scale-95",
  {
    variants: {
      variant: {
        default:
          "border-slate-200 bg-white/80 text-slate-600 hover:scale-105 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-600 hover:shadow-md",
        ghost:
          "border-transparent bg-transparent text-slate-500 shadow-none hover:bg-slate-100 hover:text-slate-800",
      },
      size: {
        default: "h-10 w-10",
        sm: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof iconButtonVariants> & {
    icon: LucideIcon;
    label: string;
  };

export function IconButton({
  icon: Icon,
  label,
  variant,
  size,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
