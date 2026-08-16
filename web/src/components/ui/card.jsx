import * as React from "react";
import { cn } from "@/lib/utils";
const Card = React.forwardRef(({ className, ...p }, ref) => (
  <div ref={ref} className={cn("rounded-xl", className)} {...p} />
));
Card.displayName = "Card";
const CardContent = React.forwardRef(({ className, ...p }, ref) => (
  <div ref={ref} className={cn("p-4", className)} {...p} />
));
CardContent.displayName = "CardContent";
export { Card, CardContent };
