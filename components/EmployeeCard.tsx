import React from "react";
import { useRouter } from "next/navigation";
import { FaEdit } from "react-icons/fa"; // Using an edit icon
import { useUser } from "@/Providers/UserProvider";

interface EmployeeCardProps {
  name: string;
  designation: string;
  employeeId: string; // Add employeeId to the props
  onClick: () => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({
  name,
  designation,
  employeeId,
  onClick,
}) => {
  const router = useRouter();
  const { currentUser, isAdmin, loading: userLoading } = useUser();

  const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    router.push(`/employees/${employeeId}/edit`);
  };

  return (
    <div
      onClick={onClick}
      className="shadow-md rounded-lg p-6 mt-2 cursor-pointer border hover:scale-105 transition duration-300 hover:border-cyan-600 relative"
    >
      <h2 className="text-xl font-bold mb-2">{name}</h2>
      <p className="text-gray-500">{designation}</p>
      <button
        onClick={handleEditClick}
        className="absolute top-4 right-4 text-blue-500 hover:text-blue-700"
      >
        {isAdmin && <FaEdit size={18} />}
      </button>
    </div>
  );
};

export default EmployeeCard;
