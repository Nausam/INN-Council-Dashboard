import React from "react";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="flex justify-center mt-6">
      <nav className="inline-flex space-x-2">
        {/* Previous Button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`px-4 py-2 border rounded-md ${
            currentPage === 1
              ? "cursor-not-allowed text-gray-400 bg-gray-100"
              : "text-black bg-white hover:border-cyan-300 hover:text-cyan-600"
          }`}
        >
          Previous
        </button>

        {/* Page Numbers */}
        {[...Array(totalPages)].map((_, index) => {
          const page = index + 1;
          return (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-4 py-2 border rounded-md ${
                currentPage === page
                  ? "bg-cyan-500 text-white"
                  : "bg-white text-black hover:border-cyan-300 hover:text-cyan-600"
              }`}
            >
              {page}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`px-4 py-2 border rounded-md ${
            currentPage === totalPages
              ? "cursor-not-allowed text-gray-400 bg-gray-100"
              : "text-black bg-white hover:border-cyan-300 hover:text-cyan-600"
          }`}
        >
          Next
        </button>
      </nav>
    </div>
  );
};

export default Pagination;
