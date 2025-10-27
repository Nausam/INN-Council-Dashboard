import { leaveTypeMapping } from "@/types";

export const EMPLOYEE_NAMES = [
  "Ahmed Azmeen",
  "Ahmed Ruzaan",
  "Ibrahim Nuhan",
  "Aminath Samaha",
  "Aishath Samaha",
  "Imran Shareef",
  "Aminath Shazuly",
  "Fazeel Ahmed",
  "Hussain Sazeen",
  "Mohamed Suhail",
  "Aminath Shaliya",
  "Fathimath Jazlee",
  "Aminath Nuha",
  "Hussain Nausam",
  "Fathimath Zeyba",
  "Fathimath Usaira",
  "Mohamed Waheedh",
  "Aishath Shaila",
  "Azlifa Mohamed Saleem",
  "Aishath Shabaana",
  "Aishath Naahidha",
  "Aishath Simaana",
  "Fazeela Naseer",
  "Buruhan",
  "Ubaidh",
];

// Reverse mapping to display the correct label for the backend value
export const reverseLeaveTypeMapping = Object.fromEntries(
  Object.entries(leaveTypeMapping).map(([label, value]) => [value, label])
);

// Format the time to display in the input field
export const formatTimeForInput = (dateTime: string | null) => {
  if (!dateTime) return "";
  const date = new Date(dateTime);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};
// Convert the input time back to ISO for saving
export const convertTimeToDateTime = (time: string, date: string) => {
  const [hours, minutes] = time.split(":");
  const dateTime = new Date(date);
  dateTime.setUTCHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  return dateTime.toISOString();
};

export const registrationDefaultValues = {
  fullName: "",
  address: "",
  contactNumber: 0,
  idCard: "",
  isCitizen: false,
  isCompany: false,
  isRetailer: false,
};
