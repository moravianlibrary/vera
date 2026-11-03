// What a query reads (E3.md, choice 3): the records as plain arrays, and the moment it runs at.
// The mock copies its database; the engine reads afresh. Store arrays are snapshots unchanged
// while a query holds them, so data derived from an array may be cached by that array.
import type { AccessGroup, Role } from "./access";
import type { StoredBatch } from "./batches";
import type {
  Category,
  Document,
  Iteration,
  Project,
  Request,
  StatusLogEntry,
  User,
} from "./entities";
import type { StoredPropertyDefinition } from "./properties";
import type { StoredRequestCustody } from "./request-custody";

export interface RecordStore {
  readonly today: Date;
  // The property keys a catalog adapter's version declares (PLG-declares).
  readonly catalogPropertyKeys: ReadonlySet<string>;
  readonly users: readonly User[];
  readonly roles: readonly Role[];
  readonly groups: readonly AccessGroup[];
  readonly categories: readonly Category[];
  readonly projects: readonly Project[];
  readonly batches: readonly StoredBatch[];
  readonly requestCustodies: readonly StoredRequestCustody[];
  readonly documents: readonly Document[];
  readonly iterations: readonly Iteration[];
  readonly requests: readonly Request[];
  readonly statusLog: readonly StatusLogEntry[];
  readonly propertyDefinitions: readonly StoredPropertyDefinition[];
}
