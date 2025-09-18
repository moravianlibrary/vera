import { z } from "zod";
import { IdentiferTypeSchema } from "./catalog";

const CatalogRecordIdentifierSchema = z.object({
    type: IdentiferTypeSchema,
    value: z.string(),
});
type CatalogRecordIdentifier = z.infer<typeof CatalogRecordIdentifierSchema>;

export { CatalogRecordIdentifierSchema };
export type { CatalogRecordIdentifier };
