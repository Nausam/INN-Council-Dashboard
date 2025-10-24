import WasteRegistrationForm from "@/components/WasteManagement/Form";
import React from "react";

const WasteManagementPage = () => {
  return (
    <div className="container mx-auto my-20">
      <h1>Waste Management Registration</h1>
      <WasteRegistrationForm type="Create" />
    </div>
  );
};

export default WasteManagementPage;
