import { z } from "zod";

const oklchColorRegex = /^oklch\([\d.]+ [\d.]+ [\d.]+\)$/;

const updateThemeSchema = z.object({
  colors: z.object({
    primary: z.string().regex(oklchColorRegex, "Must be valid OKLCH format"),
    secondary: z.string().regex(oklchColorRegex, "Must be valid OKLCH format"),
    accent: z.string().regex(oklchColorRegex, "Must be valid OKLCH format"),
    background: z.string().regex(oklchColorRegex, "Must be valid OKLCH format"),
    foreground: z.string().regex(oklchColorRegex, "Must be valid OKLCH format"),
  }),
  sectionPadding: z.enum(["xs", "sm", "md", "lg", "xl"]),
  globalRadius: z.enum(["none", "sm", "md", "lg", "full"]),
  typography: z.object({
    fontSans: z.string().min(1),
    fontSerif: z.string().min(1),
  }),
});

export type UpdateThemeDto = z.infer<typeof updateThemeSchema>;

export { updateThemeSchema };
