import React, { useState } from "react";
import { savePrayerTimes } from "@/lib/appwrite/appwrite";

const PrayerTimesForm = () => {
  const [formData, setFormData] = useState({
    date: "",
    fathisTime: "",
    mendhuruTime: "",
    asuruTime: "",
    maqribTime: "",
    ishaTime: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await savePrayerTimes(formData);
      alert("Prayer times saved successfully.");
    } catch (error) {
      alert("Error saving prayer times. Please try again.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-xl mx-auto p-6 rounded-lg bg-white"
    >
      <h2 className="text-2xl font-semibold text-gray-700 mb-6 text-center">
        Add Prayer Times
      </h2>

      {/* Date Input */}
      <div className="mb-6">
        <label
          htmlFor="date"
          className="block text-sm font-medium text-gray-600 mb-2"
        >
          Date:
        </label>
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring focus:ring-blue-500 focus:outline-none"
          required
        />
      </div>

      {/* Prayer Time Inputs */}
      {[
        "fathisTime",
        "mendhuruTime",
        "asuruTime",
        "maqribTime",
        "ishaTime",
      ].map((timeKey) => (
        <div key={timeKey} className="mb-6">
          <label
            htmlFor={timeKey}
            className="block text-sm font-medium text-gray-600 mb-2"
          >
            {timeKey.replace("Time", " Time")}:
          </label>
          <input
            type="time"
            name={timeKey}
            value={formData[timeKey as keyof typeof formData]}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring focus:ring-blue-500 focus:outline-none"
          />
        </div>
      ))}

      {/* Submit Button */}
      <button
        type="submit"
        className="w-full h-14 custom-button text-black font-normal"
      >
        Save Prayer Times
      </button>
    </form>
  );
};

export default PrayerTimesForm;
