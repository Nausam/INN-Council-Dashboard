"use client";
import LeaveRequestForm from "@/components/LeaveRequestForm ";
import React from "react";

const LeaveRequestPage = () => {
  const handleFormSubmit = (formData: {
    fullName: string;
    reason: string;
    totalDays: string;
    startDate: string;
    endDate: string;
    leaveType: string;
  }) => {
    console.log("Leave Request Submitted:", formData);
    alert("Leave request submitted successfully.");
  };

  return (
    <section className="flex items-center justify-center h-screen">
      <LeaveRequestForm onSubmit={handleFormSubmit} />
    </section>
  );
};

export default LeaveRequestPage;
