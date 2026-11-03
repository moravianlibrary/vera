import type { RequestCustody } from "./entities";

export interface StoredRequestCustody extends RequestCustody {
  readonly memberIds: readonly string[];
  readonly groupIds: readonly string[];
}
