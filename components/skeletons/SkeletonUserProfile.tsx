const UserProfileSkeleton = () => {
  return (
    <div className="flex items-center gap-4 p-2">
      {/* Avatar Placeholder */}
      <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>

      {/* Name and Email Placeholder */}
      <div className="flex flex-col gap-2">
        <div className="w-36 h-2 bg-gray-200 rounded animate-pulse"></div>
        <div className="w-28 h-2 bg-gray-200 rounded animate-pulse"></div>
      </div>

      {/* Dropdown Icon Placeholder */}
      <div className="w-2 h-4 bg-gray-200 rounded animate-pulse"></div>
    </div>
  );
};

export default UserProfileSkeleton;
