const { z } = require('zod');

const applicationSchema = z.object({
  jobId: z.string().nullable().optional(),
  fullName: z
    .string()
    .min(1, "Full Name is required")
    .max(100, "Full Name cannot exceed 100 characters")
    .regex(/^[a-zA-Z\s]+$/, "Full Name can only contain letters and spaces"),
  email: z.string().min(1, "Email address is required").email("Invalid email address"),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .regex(/^(\+\d{1,3})?\d{10}$/, "Phone number must be exactly 10 digits (or with country code, e.g. +919876543210)"),
  experienceYears: z.coerce
    .number({ invalid_type_error: "Years of Experience must be a number" })
    .min(0, "Experience must be between 0 and 50")
    .max(50, "Experience must be between 0 and 50"),
  currentCTC: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .refine(val => !val || /^\d+(\.\d+)?$/.test(val), "Current CTC must be a valid number")
    .transform(val => (val && val !== '') ? parseFloat(val) : undefined),
  expectedCTC: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .refine(val => !val || /^\d+(\.\d+)?$/.test(val), "Expected CTC must be a valid number")
    .transform(val => (val && val !== '') ? parseFloat(val) : undefined),
  noticePeriod: z.string().max(200, "Notice period cannot exceed 200 characters").optional().nullable().or(z.literal('')),
  linkedinUrl: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .refine(val => !val || /^https?:\/\/.+/.test(val), "Must be a valid LinkedIn URL starting with http:// or https://"),
  portfolioUrl: z
    .string()
    .optional()
    .nullable()
    .or(z.literal(''))
    .refine(val => !val || /^https?:\/\/.+/.test(val), "Must be a valid URL starting with http:// or https://"),
  coverLetter: z.string().max(1000, "Cover letter cannot exceed 1000 characters").optional().nullable().or(z.literal('')),
}).refine(
  (data) => {
    if (data.currentCTC !== undefined && data.expectedCTC !== undefined) {
      return data.expectedCTC >= data.currentCTC;
    }
    return true;
  },
  {
    message: "Expected CTC should generally be greater than or equal to Current CTC",
    path: ["expectedCTC"],
  }
);

module.exports = { applicationSchema };
