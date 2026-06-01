import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";

type FilterSelectOption = {
  value: string;
  label: string;
};

type FilterSelectProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: FilterSelectOption[];
  className?: string;
  id?: string;
};

export function FilterSelect({
  value,
  onChange,
  options,
  className,
  id,
}: FilterSelectProps) {
  return (
    <div className={cn("relative flex-1", className)}>
      <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <select
        id={id}
        value={value}
        onChange={onChange}
        className="council-input appearance-none py-3 pl-10 pr-10 text-sm font-medium text-slate-700"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <svg
          className="h-5 w-5 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}
