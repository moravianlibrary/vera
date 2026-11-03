// PLG-api-outcome: shared call failures.
import { z } from "zod";
import { catalogAdapterRefusalSchema } from "./catalog-adapter";
import { classifierRefusals } from "./classifier";
import { custodyRefusals } from "./custody";
import { deliveryChannelRefusalSchema } from "./delivery-channel";
import { harvesterRefusals } from "./harvester";
import { identifierRefusalSchema } from "./identifier";
import { identityRefusalSchema } from "./identity";
import { inputRefusalSchema } from "./input";
import { linkRefusalSchema } from "./link";
import { listGeneratorRefusals } from "./list-generator";
import { messageRefusals } from "./message";
import { propertySourceRefusals } from "./property-source";
import { publicationDetectorRefusals } from "./publication-detector";
import { registryRefusals } from "./registry";
import { restrictionRefusals } from "./restriction";
import { validationRefusals } from "./validation";
export const pluginUnavailableSchema = z.object({ kind: z.literal("unavailable") });
export const pluginRefusedSchema = <K extends keyof typeof pluginRefusalSchemas>(
  pluginKind: K,
  codes: (typeof pluginRefusalSchemas)[K],
) =>
  z.object({
    kind: z.literal("refused"),
    pluginKind: z.literal(pluginKind),
    code: codes,
    message: z.string(),
  });
export const pluginRefusalSchemas = {
  Identity: identityRefusalSchema,
  Input: inputRefusalSchema,
  Identifier: identifierRefusalSchema,
  Harvester: harvesterRefusals,
  CatalogAdapter: catalogAdapterRefusalSchema,
  PropertySource: propertySourceRefusals,
  Registry: registryRefusals,
  Validation: validationRefusals,
  Restriction: restrictionRefusals,
  Custody: custodyRefusals,
  Classifier: classifierRefusals,
  ListGenerator: listGeneratorRefusals,
  Link: linkRefusalSchema,
  PublicationDetector: publicationDetectorRefusals,
  Message: messageRefusals,
  DeliveryChannel: deliveryChannelRefusalSchema,
};
export const pluginUnavailable = { kind: "unavailable" as const };
export type PluginUnavailable = typeof pluginUnavailable;
export type PluginRefused = {
  [K in keyof typeof pluginRefusalSchemas]: {
    kind: "refused";
    pluginKind: K;
    code: z.infer<(typeof pluginRefusalSchemas)[K]>;
    message: string;
  };
}[keyof typeof pluginRefusalSchemas];
export const pluginRefusedSchemas = {
  Identity: pluginRefusedSchema("Identity", identityRefusalSchema),
  Input: pluginRefusedSchema("Input", inputRefusalSchema),
  Identifier: pluginRefusedSchema("Identifier", identifierRefusalSchema),
  Harvester: pluginRefusedSchema("Harvester", harvesterRefusals),
  CatalogAdapter: pluginRefusedSchema("CatalogAdapter", catalogAdapterRefusalSchema),
  PropertySource: pluginRefusedSchema("PropertySource", propertySourceRefusals),
  Registry: pluginRefusedSchema("Registry", registryRefusals),
  Validation: pluginRefusedSchema("Validation", validationRefusals),
  Restriction: pluginRefusedSchema("Restriction", restrictionRefusals),
  Custody: pluginRefusedSchema("Custody", custodyRefusals),
  Classifier: pluginRefusedSchema("Classifier", classifierRefusals),
  ListGenerator: pluginRefusedSchema("ListGenerator", listGeneratorRefusals),
  Link: pluginRefusedSchema("Link", linkRefusalSchema),
  PublicationDetector: pluginRefusedSchema("PublicationDetector", publicationDetectorRefusals),
  Message: pluginRefusedSchema("Message", messageRefusals),
  DeliveryChannel: pluginRefusedSchema("DeliveryChannel", deliveryChannelRefusalSchema),
};
