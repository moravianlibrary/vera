import type { RefusalCode } from "../refusal-codes";

export interface QueryRefusal {
  status: 403 | 404 | 409 | 410 | 422 | 429;
  code?: RefusalCode;
  message: string;
}

export type QueryOutcome<Value, Refusal extends QueryRefusal = QueryRefusal> =
  | { value: Value }
  | { refusal: Refusal };
