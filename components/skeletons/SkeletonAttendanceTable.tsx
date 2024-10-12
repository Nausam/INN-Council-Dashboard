import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SkeletonAttendanceTable = () => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="py-2 px-2">#</TableHead>
          <TableHead className="py-2 px-2 pl-10">Employee Name</TableHead>
          <TableHead className="py-2 pl-16">Sign in Time</TableHead>
          <TableHead className="py-2 pl-24">Attendance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...Array(15)].map((_, index) => (
          <TableRow key={index}>
            <TableCell className="py-2 px-2">
              <div className="h-4 w-4 bg-gray-300 animate-pulse rounded-full"></div>
            </TableCell>
            <TableCell className="py-2 pl-10">
              <div className="h-4 w- bg-gray-300 animate-pulse rounded"></div>
            </TableCell>
            <TableCell className="py-2 pl-16">
              <div className="h-6 w- bg-gray-300 animate-pulse rounded"></div>
            </TableCell>
            <TableCell className="py-2 pl-24">
              <div className="h-6 w-48 bg-gray-300 animate-pulse rounded"></div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default SkeletonAttendanceTable;
