import { z } from "zod";

/**
 * Strict WhatsApp link validation:
 * Must be HTTPS and hosted on chat.whatsapp.com, wa.me, or api.whatsapp.com.
 */
export const whatsappLinkSchema = z
  .string()
  .trim()
  .url("Must be a valid URL")
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return (
          parsed.protocol === "https:" &&
          (parsed.hostname === "chat.whatsapp.com" ||
            parsed.hostname === "wa.me" ||
            parsed.hostname === "api.whatsapp.com")
        );
      } catch {
        return false;
      }
    },
    {
      message:
        "WhatsApp link must be a valid HTTPS link starting with https://chat.whatsapp.com/ or https://wa.me/",
    }
  );

export const registrationSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(60, "First name cannot exceed 60 characters."),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required.")
    .max(60, "Last name cannot exceed 60 characters."),
  phone: z
    .string()
    .trim()
    .min(7, "Phone number is too short.")
    .max(25, "Phone number cannot exceed 25 characters.")
    .regex(/^[+0-9\s\-()]+$/, "Phone number contains invalid characters."),
  techSkill: z
    .string()
    .trim()
    .min(1, "Please choose a learning track.")
    .max(100, "Track name cannot exceed 100 characters."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .max(100, "Email cannot exceed 100 characters.")
    .refine((email) => email.endsWith("@gmail.com"), {
      message: "Only Gmail addresses (@gmail.com) are allowed.",
    }),
});

export const trackSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Track name is required.")
    .max(100, "Track name cannot exceed 100 characters."),
  whatsappLink: whatsappLinkSchema,
});

export const certificateTemplateSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200).optional(),
  subtitle: z.string().trim().min(1, "Subtitle is required.").max(200).optional(),
  bodyText: z.string().trim().max(500, "Description text is too long.").optional(),
  defaultTrack: z.string().trim().max(100).optional(),
  signatoryName: z.string().trim().max(100).optional(),
  signatoryTitle: z.string().trim().max(100).optional(),
  signatureUrl: z.string().trim().max(3000000).optional(), // Allows high-res PNG data URLs
  signatory2Name: z.string().trim().max(100).optional(),
  signatory2Title: z.string().trim().max(100).optional(),
  signatory2SignatureUrl: z.string().trim().max(3000000).optional(),
  logoUrl: z.string().trim().max(2000).optional(),
  logoName: z.string().trim().max(100).optional(),
  badgeText: z.string().trim().max(100).optional(),
  dateText: z.string().trim().max(100).optional(),
});

export const supportLinkSchema = z.object({
  whatsappLink: z.union([whatsappLinkSchema, z.literal("")]).optional(),
});
