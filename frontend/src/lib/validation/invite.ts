import { z } from "zod";

export const inviteCodeSchema = z.object({
  code: z.string().trim().min(6, "Code required"),
});
export const redeemSchema = z.object({
  code: z.string().trim().min(6),
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Min 8 chars"),
});

export type InviteCodeInput = z.infer<typeof inviteCodeSchema>;
export type RedeemInput = z.infer<typeof redeemSchema>;
