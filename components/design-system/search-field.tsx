import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

type SearchFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string;
};

export function SearchField({
  className,
  wrapperClassName,
  ...props
}: SearchFieldProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        className={cn("council-input py-3.5 pl-12 pr-4", className)}
        {...props}
      />
    </div>
  );
}
