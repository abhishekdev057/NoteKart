import { z } from "zod";

const mobile = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, "").slice(-10))
  .refine((value) => /^[6-9]\d{9}$/.test(value), { error: "Enter a valid 10 digit mobile number." });

export const otpRequestSchema = z.object({ mobile });

export const otpVerifySchema = z.object({
  mobile,
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, { error: "Enter the OTP sent to your mobile." }),
});

export const productSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, { error: "Name is required." }).max(160),
  slug: z.string().trim().max(160).optional(),
  category: z.string().trim().max(80).default("Notebooks"),
  price: z.number().int().nonnegative().max(1_000_000),
  compareAtPrice: z.number().int().nonnegative().max(1_000_000).nullable().optional(),
  stock: z.number().int().nonnegative().max(1_000_000).default(0),
  description: z.string().trim().max(4000).default(""),
  specs: z.record(z.string(), z.string()).default({}),
  images: z.array(z.string().url()).max(12).default([]),
  isCustomizable: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
});

export const customRequestSchema = z.object({
  customerName: z.string().trim().min(1, { error: "Name is required." }).max(120),
  mobile,
  notes: z.string().trim().max(2000).default(""),
  quantity: z.coerce.number().int().min(1).max(100000).default(1),
  imageUrl: z.string().url().nullable().optional(),
});

export const orderSchema = z.object({
  customerName: z.string().trim().min(1, { error: "Name is required." }).max(120),
  address: z.string().trim().min(6, { error: "A delivery address is required." }).max(600),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        quantity: z.number().int().min(1).max(1000),
      }),
    )
    .min(1, { error: "Your cart is empty." })
    .max(50),
});

export const deliverySchema = z.object({
  provider: z.enum(["review", "delhivery", "post_office", "manual"]).default("review"),
  trackingNumber: z.string().trim().max(120).nullable().optional(),
  deliveryStatus: z.enum(["review", "packed", "assigned", "shipped", "delivered"]).default("review"),
  deliveryNotes: z.string().trim().max(2000).nullable().optional(),
});
