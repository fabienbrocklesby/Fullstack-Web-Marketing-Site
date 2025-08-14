import { z } from "zod";

export const enquirySchema = z.object({
  fullName: z.string().min(2, "Full name required"),
  email: z.string().email("Valid email required"),
  company: z.string().optional().or(z.literal("")),
  useCase: z.string().min(5, "Tell us a bit more").max(2000, "Too long"),
  planInterested: z.string().min(1, "Select a plan"),
  affiliateCode: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export type EnquiryInput = z.infer<typeof enquirySchema>;
