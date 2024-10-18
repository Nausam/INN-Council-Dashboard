import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmployeeListCardProps {
  title: string;
  employees: string[];
  bgColor: string;
  emptyMessage: string;
}

const EmployeeListCard: React.FC<EmployeeListCardProps> = ({
  title,
  employees,
  bgColor,
  emptyMessage,
}) => (
  <Card className="w-full max-w-lg mx-auto mt-8 shadow-xl rounded-lg ">
    <CardHeader>
      <CardTitle className="text-2xl font-semibold text-gray-700">
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      {employees.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {employees.map((name, index) => (
            <div
              key={index}
              className={cn("p-2 rounded-full shadow-lg text-sm text-white")}
              style={{
                boxShadow: `0px 4px 10px 0px rgba(0, 0, 0, 0.15) inset`,
                backgroundColor: bgColor,
              }}
            >
              {name}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">{emptyMessage}</p>
      )}
    </CardContent>
  </Card>
);

export default EmployeeListCard;
