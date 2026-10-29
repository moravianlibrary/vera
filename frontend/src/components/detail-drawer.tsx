import { XIcon } from "lucide-react";
import { Dialog as DrawerPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}

export function DetailDrawer({ open, onClose, title, subtitle, children }: DetailDrawerProps) {
  return (
    <DrawerPrimitive.Root
      open={open}
      modal={false}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Content
          onInteractOutside={(event) => event.preventDefault()}
          className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-background shadow-xl outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right sm:w-[28rem]"
        >
          <div className="flex items-start gap-3 border-b px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <DrawerPrimitive.Title className="text-[0.9375rem] font-semibold leading-snug">
                {title}
              </DrawerPrimitive.Title>
              <DrawerPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                {subtitle}
              </DrawerPrimitive.Description>
            </div>
            <DrawerPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="-mr-2 size-8" aria-label="Close">
                <XIcon />
              </Button>
            </DrawerPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
