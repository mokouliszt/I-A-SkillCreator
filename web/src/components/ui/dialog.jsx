import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef(({ className, ...p }, ref) => (
  <DialogPrimitive.Overlay ref={ref} className={cn("fixed inset-0 z-50 bg-black/70", className)} {...p} />
));
DialogOverlay.displayName = "DialogOverlay";
const DialogContent = React.forwardRef(({ className, children, ...p }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref}
      className={cn("fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl p-5 shadow-xl", className)}
      {...p}>
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 text-neutral-500">
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";
const DialogHeader = ({ className, ...p }) => <div className={cn("mb-4", className)} {...p} />;
const DialogTitle = React.forwardRef(({ className, ...p }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("font-semibold", className)} {...p} />
));
DialogTitle.displayName = "DialogTitle";
export { Dialog, DialogContent, DialogHeader, DialogTitle };
