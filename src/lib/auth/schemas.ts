import { z } from "zod";

export const loginPayloadSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters.")
    .max(128)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password is too long."),
});

export type LoginPayload = z.infer<typeof loginPayloadSchema>;
