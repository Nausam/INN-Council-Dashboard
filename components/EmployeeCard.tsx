import React from "react";

interface EmployeeCardProps {
  name: string;
  designation: string;
  onClick: () => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({
  name,
  designation,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className="shadow-md rounded-lg p-6 mt-2 cursor-pointer border hover:scale-105 transition duration-300 hover:border-cyan-600"
    >
      <h2 className="text-xl font-bold mb-2">{name}</h2>
      <p className="text-gray-500">{designation}</p>
    </div>
  );
};

export default EmployeeCard;
