const { z } = require('zod');

const applicationSchema = z.object({
  jobId: z.string().nullable().optional(),
  fullName: z
    .string()
    .min(2, "Full Name must be at least 2 characters")
    .max(100, "Full Name cannot exceed 100 characters")
    .regex(/^[a-zA-Z\s]+$/, "Full Name can only contain letters and spaces"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .regex(/^\+?[0-9\s-]{10,15}$/, "Phone number must be 10-15 digits"),
  experienceYears: z.coerce
    .number()
    .min(0, "Experience cannot be negative")
    .max(50, "Experience cannot exceed 50 years"),
  currentCTC: z.coerce.number().min(0, "CTC must be positive").optional().nullable(),
  expectedCTC: z.coerce.number().min(0, "CTC must be positive").optional().nullable(),
  noticePeriod: z.string().max(50, "Notice period cannot exceed 50 characters").optional().nullable(),
  linkedinUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal('')),
  portfolioUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal('')),
  coverLetter: z.string().max(1000, "Cover letter cannot exceed 1000 characters").optional().nullable(),
}).refine(
  (data) => {
    if (data.currentCTC && data.expectedCTC) {
      return data.expectedCTC >= data.currentCTC;
    }
    return true;
  },
  {
    message: "Expected CTC should generally be greater than or equal to Current CTC",
    path: ["expectedCTC"], // Attribute the error to expectedCTC
  }
);

module.exports = { applicationSchema };
