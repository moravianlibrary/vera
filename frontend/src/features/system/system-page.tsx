// The frame of the pages that are not a view (ui-gates.md G-STATE-4): the mark, a title, one
// sentence and at most two actions. Outside the shell it fills the screen; inside, the pane.

import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

interface SystemPageProps {
  title: string;
  // One sentence; the login page has none once its entries show.
  text?: string;
  actions?: ReactNode;
  // What the page needs besides its sentence: the login entries, a reference.
  children?: ReactNode;
  isInShell?: boolean;
}

export function SystemPage({ title, text, actions, children, isInShell }: SystemPageProps) {
  return (
    <div
      className={cn(
        "grid place-items-center bg-background px-4 py-12",
        isInShell ? "min-h-0 flex-1 overflow-y-auto" : "min-h-svh",
      )}
    >
      <div className="w-full max-w-sm text-center">
        <Logo className="mx-auto size-10 text-foreground" markClassName="fill-background" />
        <h1 className="mt-5 text-xl font-semibold">{title}</h1>
        {text !== undefined && <p className="mt-2 text-sm text-muted-foreground">{text}</p>}
        {children}
        {actions !== undefined && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
