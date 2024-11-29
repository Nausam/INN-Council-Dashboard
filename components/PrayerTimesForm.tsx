import React, { useState } from "react";
import { savePrayerTimes } from "@/lib/appwrite";

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
      className="max-w-md mx-auto p-4 border rounded"
    >
      <h2 className="text-lg font-bold mb-4">Add Prayer Times</h2>
      <label>Date:</label>
      <input
        type="date"
        name="date"
        value={formData.date}
        onChange={handleInputChange}
        className="w-full border p-2 mb-4"
        required
      />
      {[
        "fathisTime",
        "mendhuruTime",
        "asuruTime",
        "maqribTime",
        "ishaTime",
      ].map((timeKey) => (
        <div key={timeKey} className="mb-4">
          <label>{timeKey.replace("Time", " Time")}</label>
          <input
            type="time"
            name={timeKey}
            value={formData[timeKey as keyof typeof formData]}
            onChange={handleInputChange}
            className="w-full border p-2"
          />
        </div>
      ))}
      <button
        type="submit"
        className="w-full bg-blue-500 text-white p-2 rounded"
      >
        Save Prayer Times
      </button>
    </form>
  );
};

export default PrayerTimesForm;
