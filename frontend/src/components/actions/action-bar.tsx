// A row of declared actions, in a page header or a pane (component-interfaces.md §1.1). The cap
// on buttons is applied here once, rather than by each view: phone 1, small 2, notebook and
// large 3 (view-rules.md §5.2); the rest go into "…" in declared order. An irreversible action
// is never primary-styled on a phone (§5.3). The caller passes only what the person may do to
// this record: an action they may not is absent, never disabled (§5.1). A pane names its menu,
// "More ▾", and keeps the record's rarer acts in it whatever the cap.
// TODO(rrandiak): labels move to i18n.

import type { LucideIcon } from "lucide-react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tier } from "@/hooks/use-tier";
import { useTier } from "@/hooks/use-tier";
import { cn } from "@/lib/utils";

// What an action does: run something, or go somewhere.
export type ActionTarget = { onSelect: () => void } | { href: string };

export type ViewAction = ActionTarget & {
  id: string;
  // Ends with "…" when it opens a dialog.
  label: string;
  icon?: LucideIcon;
  // Filled rather than outlined.
  isPrimary?: boolean;
  // Red; irreversible or seen outside (view-rules.md §5.3).
  isDestructive?: boolean;
  // Always in the menu, never a button: a pane's More ▾.
  isInMenu?: boolean;
};

export const primaryCaps = {
  phone: 1,
  small: 2,
  notebook: 3,
  large: 3,
} as const satisfies Record<Tier, number>;

interface ActionBarProps {
  actions: readonly ViewAction[];
  // How many show as buttons; defaults to the tier's cap.
  cap?: number;
  // The menu as a named button, "More", rather than "…".
  menuLabel?: string;
  className?: string;
}

export function ActionBar({ actions, cap, menuLabel, className }: ActionBarProps) {
  const tier = useTier();
  if (actions.length === 0) {
    return null;
  }

  const buttons = actions.filter((action) => action.isInMenu !== true);
  const shown = buttons.slice(0, cap ?? primaryCaps[tier]);
  const folded = actions.filter((action) => !shown.includes(action));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {shown.map((action) => (
        <ActionButton key={action.id} action={action} isPhone={tier === "phone"} />
      ))}

      {folded.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {menuLabel === undefined ? (
              <Button variant="outline" size="icon-sm" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            ) : (
              <Button variant="outline" size="sm">
                {menuLabel}
                <ChevronDown />
              </Button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {folded.map((action) => (
              <ActionMenuItem key={action.id} action={action} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function ActionButton({ action, isPhone }: { action: ViewAction; isPhone: boolean }) {
  const isFilled = action.isPrimary === true && !(isPhone && action.isDestructive === true);
  const variant = isFilled ? (action.isDestructive ? "destructive" : "default") : "outline";
  const content = (
    <>
      {action.icon !== undefined && <action.icon />}
      {action.label}
    </>
  );

  if ("href" in action) {
    return (
      <Button asChild size="sm" variant={variant}>
        <Link to={action.href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant={variant}
      className={cn(!isFilled && action.isDestructive && "text-destructive")}
      onClick={action.onSelect}
    >
      {content}
    </Button>
  );
}

function ActionMenuItem({ action }: { action: ViewAction }) {
  const className = cn(action.isDestructive && "text-destructive");
  if ("href" in action) {
    return (
      <DropdownMenuItem asChild className={className}>
        <Link to={action.href}>{action.label}</Link>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem className={className} onSelect={action.onSelect}>
      {action.label}
    </DropdownMenuItem>
  );
}
