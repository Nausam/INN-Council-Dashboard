import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  <Card className="w-full max-w-lg mx-auto mt-8 shadow-lg">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      {employees.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {employees.map((name, index) => (
            <div
              key={index}
              className={`p-2 rounded-md shadow-md text-sm text-white ${bgColor}`}
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
