import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmployeeListCardProps {
  title: string;
  employees: string[];
  bgColor: string;
  emptyMessage: string;
  gradient: string;
}

const EmployeeListCard: React.FC<EmployeeListCardProps> = ({
  title,
  employees,
  bgColor,
  emptyMessage,
  gradient,
}) => (
  <Card
    style={{
      background: gradient,
    }}
    className="w-full max-w-lg mx-auto shadow-lg rounded-xl border-none overflow-hidden"
  >
    <CardHeader className="p-6 bg-opacity-50 bg-white">
      <CardTitle className="text-xl font-semibold text-gray-800">
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="p-6 bg-white h-full">
      {employees.length > 0 ? (
        <ul className="space-y-3">
          {employees.map((name, index) => (
            <li
              key={index}
              className="flex items-center gap-3 p-3 bg-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-white font-bold shadow-lg"
                style={{
                  backgroundColor: bgColor,
                }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="text-gray-800 text-sm font-medium">{name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-6 text-center text-gray-600">
          <p className="text-base font-medium">{emptyMessage}</p>
        </div>
      )}
    </CardContent>
  </Card>
);

export default EmployeeListCard;
