// The steps of a stepped dialog in its head (component-interfaces.md §6.7): done ones ticked, the
// current one filled, the rest numbered.

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  steps: readonly string[];
  currentIndex: number;
}

export function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs font-normal text-muted-foreground">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          {index > 0 && <span aria-hidden className="h-px w-6 bg-border" />}
          <span
            aria-current={index === currentIndex ? "step" : undefined}
            className={cn("flex items-center gap-1.5", index === currentIndex && "text-foreground")}
          >
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full border text-caption",
                index === currentIndex && "border-primary bg-primary text-primary-foreground",
                index < currentIndex && "border-transparent bg-muted",
              )}
            >
              {index < currentIndex ? <Check className="size-3" /> : index + 1}
            </span>
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}
