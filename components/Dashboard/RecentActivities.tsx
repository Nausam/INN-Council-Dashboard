import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FaHistory } from "react-icons/fa";

const RecentActivities: React.FC<{
  activities: { time: string; event: string }[];
}> = ({ activities }) => {
  return (
    <Card className="shadow-lg rounded-xl w-full p-6">
      <CardHeader className="flex items-center gap-3">
        <FaHistory className="text-blue-500" size={24} />
        <CardTitle className="text-xl font-bold text-gray-800">
          Recent Activities
        </CardTitle>
      </CardHeader>
      <CardContent className="mt-4">
        {activities.length > 0 ? (
          <ul className="space-y-4">
            {activities.map((activity, index) => (
              <li
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition"
              >
                <span className="text-gray-700">{activity.event}</span>
                <span className="text-sm text-gray-500">{activity.time}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-center">
            No recent activities to show.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivities;
