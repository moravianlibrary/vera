import { XIcon } from "lucide-react";
import { Dialog as DrawerPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SwipePeekPill } from "@/components/swipe-peek-pill";
import { Button } from "@/components/ui/button";
import type { RecordSwipe } from "@/hooks/use-swipe-between";
import { useSwipeBetween, useSwipeToClose } from "@/hooks/use-swipe-between";
import { useTier } from "@/hooks/use-tier";

interface DetailDrawerProps<Item> {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  swipe?: RecordSwipe<Item>;
}

export function DetailDrawer<Item>({
  open,
  onClose,
  title,
  subtitle,
  children,
  swipe,
}: DetailDrawerProps<Item>) {
  const { t } = useTranslation("common");
  const isPhone = useTier() === "phone";
  const swiping = useSwipeBetween({
    ...(swipe ?? {
      items: [],
      currentId: null,
      idOf: () => "",
      labelOf: () => "",
      onSelect: () => undefined,
    }),
    isEnabled: open && isPhone && swipe !== undefined,
  });
  const closeGesture = useSwipeToClose(onClose);
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
          className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-background shadow-xl outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right sm:w-112"
        >
          <div {...closeGesture} className="flex items-start gap-3 border-b px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <DrawerPrimitive.Title className="text-title font-semibold leading-snug">
                {t(title)}
              </DrawerPrimitive.Title>
              <DrawerPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                {subtitle}
              </DrawerPrimitive.Description>
            </div>
            <DrawerPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 size-8"
                aria-label={t("drawer.close")}
              >
                <XIcon />
              </Button>
            </DrawerPrimitive.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            <SwipePeekPill peek={swiping.peek} />
            <div {...swiping.bind} className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-5 py-4">
              {children}
            </div>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
