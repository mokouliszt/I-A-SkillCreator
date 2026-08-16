import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
const Tabs = TabsPrimitive.Root;
const TabsList = React.forwardRef(({ className, ...p }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn("inline-flex items-center justify-center", className)} {...p} />
));
TabsList.displayName = "TabsList";
const TabsTrigger = React.forwardRef(({ className, ...p }, ref) => (
  <TabsPrimitive.Trigger ref={ref}
    className={cn("inline-flex items-center justify-center whitespace-nowrap px-3 py-2 font-medium transition-all text-neutral-400 data-[state=active]:bg-[#2C2B28] data-[state=active]:text-neutral-100", className)}
    {...p} />
));
TabsTrigger.displayName = "TabsTrigger";
const TabsContent = React.forwardRef(({ className, ...p }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("outline-none", className)} {...p} />
));
TabsContent.displayName = "TabsContent";
export { Tabs, TabsList, TabsTrigger, TabsContent };
