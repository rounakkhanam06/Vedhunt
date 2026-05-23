const { z } = require('zod');

const serviceCreateSchema = z.object({
  id_string: z.string().min(2, "ID String must be at least 2 characters").max(50, "ID String too long"),
  slug: z.string().min(2, "Slug must be at least 2 characters").max(50, "Slug too long"),
  title: z.string().min(2, "Title must be at least 2 characters").max(100, "Title too long"),
  subtitle: z.string().max(200, "Subtitle too long").optional().nullable(),
  shortDescription: z.string().max(500, "Short Description too long").optional().nullable(),
  description: z.string().optional().nullable(),
  subServices: z.string().optional().nullable(),
  iconName: z.string().min(1, "Icon name is required"),
  features: z.union([z.array(z.string()), z.string()]).optional(),
  cta: z.string().max(50).optional().nullable(),
  imageUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal('')),
  imagePublicId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  showOnHome: z.boolean().optional(),
  showOnServicesPage: z.boolean().optional(),
});

const serviceUpdateSchema = serviceCreateSchema.partial();

module.exports = { serviceCreateSchema, serviceUpdateSchema };
