// UI-names: a property, its enum values and its values in the language in use.

import type { PropertyDefinition, PropertyValue } from "@vera/domain/properties";
import {
  enumValueNameOf as enumValueNameIn,
  formatPropertyValue as formatPropertyValueIn,
  propertyNameOf as propertyNameIn,
} from "@vera/domain/properties";
import { i18n } from "@/i18n";

const languageInUse = (): "cs" | "en" => (i18n.language === "cs" ? "cs" : "en");

export function propertyNameOf(definition: Pick<PropertyDefinition, "names">): string {
  return propertyNameIn(definition, languageInUse());
}

export function enumValueNameOf(definition: PropertyDefinition, value: string): string {
  return enumValueNameIn(definition, value, languageInUse());
}

export function formatPropertyValue(definition: PropertyDefinition, value: PropertyValue): string {
  return formatPropertyValueIn(definition, value, languageInUse());
}
