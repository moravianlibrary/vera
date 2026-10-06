// One mutation per action (component-interfaces.md §9.7). The server's refusal (403, 404, 409,
// 422) comes back as a value the dialog shows beside what was typed, never as a toast; any other
// failure is said the same way, as one that may pass on a retry. On success the lists, details
// and counts the action touches are refetched without being awaited, so the dialog closes at
// once and the refetch takes the record off the list after.
// TODO(rrandiak): the server's own wording of a refusal, once its error body is settled.

import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/http";

export const refusalStatuses = [403, 404, 409, 422] as const;
export type RefusalStatus = (typeof refusalStatuses)[number];

export interface Refusal {
  // Null for a failure that was not a refusal: a network error or the server's own fault.
  readonly status: RefusalStatus | null;
  readonly message: string;
}

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
  // The action's own words for a refusal, where the default says too little.
  refusalTexts?: Partial<Record<RefusalStatus, string>>;
}

export function useActionMutation<Input, Value>({
  call,
  invalidates,
  refusalTexts = {},
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
      return { isDone: true, value: await mutation.mutateAsync(input) };
    } catch (error) {
      return { isDone: false, refusal: refusalOf(error, refusalTexts) };
    }
  };

  return { run, isPending: mutation.isPending };
}

function refusalOf(error: unknown, texts: Partial<Record<RefusalStatus, string>>): Refusal {
  const status = refusalStatuses.find(
    (candidate) => error instanceof ApiError && error.status === candidate,
  );
  if (status === undefined) {
    return { status: null, message: failureText };
  }

  return { status, message: texts[status] ?? defaultRefusalTexts[status] };
}
