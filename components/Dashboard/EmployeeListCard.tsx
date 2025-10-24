import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";

interface EmployeeListCardProps {
  title: string;
  employees: string[];
  bgColor: string; // dot color inside the pill
  emptyMessage: string;
  gradient: string; // header background only
}

const EmployeeListCard: React.FC<EmployeeListCardProps> = ({
  title,
  employees,
  bgColor,
  emptyMessage,
  gradient,
}) => {
  return (
    <Card
      className="
        w-full max-w-xl mx-auto
        rounded-2xl border border-gray-200/70
        bg-white/80 backdrop-blur
        shadow-sm hover:shadow-md transition-shadow
      "
    >
      {/* Gradient only on the header so no color band at the bottom */}
      <CardHeader
        style={{ background: gradient }}
        className="p-4 rounded-t-2xl border-b border-gray-100"
      >
        <CardTitle className="text-base md:text-lg font-semibold text-white">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 ">
        {employees.length > 0 ? (
          <div className="flex flex-wrap gap-2 ">
            {employees.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="
                  inline-flex items-center gap-2
                  rounded-full bg-gray-50
                  px-3 py-1 text-sm text-gray-800
                  ring-1 ring-gray-200 shadow-xs
                  hover:bg-gray-100 transition
                "
                title={name}
              >
                <span
                  className="
                    inline-flex h-5 w-5 items-center justify-center
                    rounded-full text-[11px] font-bold text-white
                    shadow-sm border 
                  "
                  style={{ backgroundColor: bgColor }}
                >
                  {name?.trim()?.charAt(0)?.toUpperCase() || "•"}
                </span>
                <span className="whitespace-nowrap">{name}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <p className="text-sm">{emptyMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeListCard;
