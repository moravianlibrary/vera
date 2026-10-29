// One mutation per action (component-interfaces.md §9.7). The server's refusal (403, 404, 409,
// 422) comes back as a value the dialog shows beside what was typed, never as a toast; any other
// failure is said the same way, as one that may pass on a retry. On success the lists, details
// and counts the action touches are refetched without being awaited, so the dialog closes at
// once and the refetch takes the record off the list after. A refusal is worded by the action's
// text for its Problem Details code, else by the server's own detail, else by the action's text
// for its status, else by the default for the status.
// TODO(rrandiak): words by code move to i18n, and a 422's `errors` go beside their fields.

import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/http";
import { recordAct } from "@/lib/telemetry/telemetry";

export const refusalStatuses = [403, 404, 409, 422] as const;
export type RefusalStatus = (typeof refusalStatuses)[number];

export interface Refusal {
  // Null for a failure that was not a refusal: a network error or the server's own fault.
  readonly status: RefusalStatus | null;
  // The Problem Details code, when the server gave one.
  readonly code: string | null;
  readonly message: string;
}

// By status, or by a Problem Details code such as "iteration.scanned".
export type RefusalTexts = Readonly<Partial<Record<RefusalStatus | (string & {}), string>>>;

export type ActionResult<Value> =
  | { readonly isDone: true; readonly value: Value }
  | { readonly isDone: false; readonly refusal: Refusal };

const defaultRefusalTexts = {
  403: "You may no longer do this.",
  404: "It is no longer here.",
  409: "Someone has changed it meanwhile.",
  422: "The server did not accept what was entered.",
} as const satisfies Record<RefusalStatus, string>;

const failureText = "It could not be saved. Try again.";

interface ActionMutationOptions<Input, Value> {
  call: (input: Input) => Promise<Value>;
  // What to refetch once it is done.
  invalidates: readonly QueryKey[];
  // The action's own words for a refusal, where the server's or the default say too little.
  refusalTexts?: RefusalTexts;
  act?: string;
}

export function useActionMutation<Input, Value>({
  call,
  invalidates,
  refusalTexts = {},
  act,
}: ActionMutationOptions<Input, Value>) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: call,
    onSuccess: () => {
      for (const queryKey of invalidates) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  const run = async (input: Input): Promise<ActionResult<Value>> => {
    try {
      const value = await mutation.mutateAsync(input);
      if (act !== undefined) recordAct(act, "done");
      return { isDone: true, value };
    } catch (error) {
      const refusal = refusalOf(error, refusalTexts);
      if (act !== undefined) {
        recordAct(
          act,
          "refused",
          refusal.status ?? (error instanceof ApiError ? error.status : undefined),
        );
      }
      return { isDone: false, refusal };
    }
  };

  return { run, isPending: mutation.isPending };
}

function refusalOf(error: unknown, texts: RefusalTexts): Refusal {
  const status = refusalStatuses.find(
    (candidate) => error instanceof ApiError && error.status === candidate,
  );
  if (!(error instanceof ApiError) || status === undefined) {
    return { status: null, code: null, message: failureText };
  }

  const code = error.problem?.code ?? null;
  const message =
    (code === null ? undefined : texts[code]) ??
    error.problem?.detail ??
    texts[status] ??
    defaultRefusalTexts[status];
  return { status, code, message };
}
