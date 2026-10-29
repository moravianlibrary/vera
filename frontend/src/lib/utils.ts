import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The type and shadow steps of globals.css (ui-gates.md G-STYLE-2, G-STYLE-4): without them
// tailwind-merge reads text-ui as a color and drops it beside text-foreground.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["2xs", "caption", "ui", "title"] }],
      shadow: [{ shadow: ["mark", "mark-purple", "peek"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
