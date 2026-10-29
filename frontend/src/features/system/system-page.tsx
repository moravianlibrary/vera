// The frame of the pages that are not a view (ui-gates.md G-STATE-4): the mark, a title, one
// sentence and at most two actions. Outside the shell it is a card on a tinted page, with what
// belongs beside it (the language, another way in) under it; inside, it fills the pane plainly.

import { Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import type { Appearance } from "@/hooks/use-appearance";
import { usePickedAppearance } from "@/hooks/use-appearance";

interface SystemPageProps {
  title: string;
  // One sentence; the login page has none once its entries show.
  text?: string;
  actions?: ReactNode;
  // What the page needs besides its sentence: the login entries, a reference.
  children?: ReactNode;
  // Under the card, outside it: the language pick, a link to the other way in.
  footer?: ReactNode;
  isInShell?: boolean;
}

export function SystemPage({ title, text, actions, children, footer, isInShell }: SystemPageProps) {
  const content = (
    <>
      <div className="text-center">
        <Logo className="mx-auto size-10 text-foreground" markClassName="fill-background" />
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        {text !== undefined && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}
      </div>
      {children}
      {actions !== undefined && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>
      )}
    </>
  );

  if (isInShell) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto bg-background px-4 py-12">
        <div className="w-full max-w-sm">{content}</div>
      </div>
    );
  }

  return <CardPage footer={footer}>{content}</CardPage>;
}

// Outside the shell nobody may be logged in, so the page shows this browser's appearance and
// offers to change it, under the card beside whatever else the page puts there.
function CardPage({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const { t } = useTranslation("system");
  const { appearance, setAppearance } = usePickedAppearance();
  return (
    <div className="grid min-h-svh place-items-center bg-muted/50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
          {children}
        </div>
        <div className="mt-4 grid justify-items-center gap-2 text-sm text-muted-foreground">
          {footer}
          <div className="flex items-center gap-1">
            <span>{t("appearance.label")}</span>
            {appearanceChoices.map(({ value, Icon }) => (
              <Button
                key={value}
                size="icon-sm"
                variant="ghost"
                aria-label={t(`appearance.${value}`)}
                title={t(`appearance.${value}`)}
                aria-pressed={appearance === value}
                className="aria-pressed:bg-muted aria-pressed:text-foreground"
                onClick={() => setAppearance(value)}
              >
                <Icon />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const appearanceChoices = [
  { value: "system", Icon: Monitor },
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
] as const satisfies readonly { value: Appearance; Icon: typeof Sun }[];

// A line across a card with a word in it: "or" between two ways in.
export function SystemDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
