const { z } = require('zod');

const heroUpdateSchema = z.object({
  heading: z.string().min(3, "Heading must be at least 3 characters").max(100, "Heading too long"),
  subheading: z.string().max(300, "Subheading too long").optional().nullable(),
  primaryButtonText: z.string().max(50).min(1, "Primary button text required"),
  primaryButtonLink: z.string(), // could use z.string().url() if we strictly want full URLs, but we might have relative links like "/contact"
  secondaryButtonText: z.string().max(50).optional().nullable(),
  secondaryButtonLink: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  backgroundImageUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal('')),
  backgroundImagePublicId: z.string().optional().nullable(),
  backgroundVideoUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional(),
});

module.exports = { heroUpdateSchema };
