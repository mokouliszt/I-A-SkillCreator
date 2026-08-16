import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
const Checkbox = React.forwardRef(({ className, ...p }, ref) => (
  <CheckboxPrimitive.Root ref={ref}
    className={cn("peer h-4 w-4 shrink-0 rounded border border-neutral-600 data-[state=checked]:border-[#D97757] data-[state=checked]:bg-[#D97757]", className)}
    {...p}>
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-[#1B1A18]">
      <Check className="h-3 w-3" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
export { Checkbox };
