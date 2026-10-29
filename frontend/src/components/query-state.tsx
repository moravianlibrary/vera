// What a region shows while its data is not there (ui-gates.md G-STATE-1): a line while it
// loads, the error with Try again when it could not load, a line when there is nothing, and
// otherwise its content. Lists, tables and panes take the same error through their own props.

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A failed query: what to say, and how to ask again.
export interface QueryFailure {
  text: string;
  onRetry: () => void;
}

// The failure of a query result, or undefined while it has not failed.
export function failureOf(
  query: { isError: boolean; refetch: () => unknown },
  text: string,
): QueryFailure | undefined {
  return query.isError ? { text, onRetry: () => void query.refetch() } : undefined;
}

export function QueryError({ failure, className }: { failure: QueryFailure; className?: string }) {
  const { t } = useTranslation("system");
  return (
    <div
      role="alert"
      className={cn("flex flex-wrap items-center gap-3 p-4 text-sm text-destructive", className)}
    >
      <span>{failure.text}</span>
      <Button size="sm" variant="outline" onClick={failure.onRetry}>
        {t("action.tryAgain")}
      </Button>
    </div>
  );
}

interface QueryStateProps {
  isLoading: boolean;
  failure: QueryFailure | undefined;
  loadingText?: string;
  // Shown instead of the content when there is nothing.
  isEmpty?: boolean;
  emptyText?: string;
  children: ReactNode;
}

export function QueryState({
  isLoading,
  failure,
  loadingText,
  isEmpty = false,
  emptyText,
  children,
}: QueryStateProps) {
  const { t } = useTranslation("system");
  if (failure !== undefined) {
    return <QueryError failure={failure} />;
  }

  if (isLoading) {
    return (
      <p role="status" className="p-4 text-sm text-muted-foreground">
        {loadingText ?? t("query.loading")}
      </p>
    );
  }

  if (isEmpty) {
    return <p className="p-4 text-sm text-muted-foreground">{emptyText}</p>;
  }

  return children;
}
