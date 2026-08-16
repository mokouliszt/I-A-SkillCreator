import * as React from "react";
import { cn } from "@/lib/utils";
const Input = React.forwardRef(({ className, type, ...p }, ref) => (
  <input type={type} ref={ref}
    className={cn("flex h-10 w-full rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#D97757]", className)}
    {...p} />
));
Input.displayName = "Input";
export { Input };
