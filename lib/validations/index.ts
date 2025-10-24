import { z } from "zod";

// Define the schema for the form data
export const createRegistrationSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  address: z.string().min(1, "Address is required"),
  contactNumber: z
    .number()
    .int("Contact number must be an integer")
    .positive("Contact number must be a positive number")
    .refine(
      (val) => val.toString().length >= 10 && val.toString().length <= 15,
      "Contact number must be between 10 and 15 digits"
    ),
  idCard: z.string().min(1, "ID card is required"),
  isCitizen: z
    .boolean()
    .refine(
      (val) => val === true || val === false,
      "Must specify if the person is a citizen"
    ),
  isCompany: z
    .boolean()
    .refine(
      (val) => val === true || val === false,
      "Must specify if the entity is a company"
    ),
  isRetailer: z
    .boolean()
    .refine(
      (val) => val === true || val === false,
      "Must specify if the entity is a retailer"
    ),
});
