// UI-names: a property, its enum values and its values in the language in use.

import type { PropertyDefinition, PropertyValue } from "@vera/domain/properties";
import {
  enumValueNameOf as enumValueNameIn,
  formatPropertyValue as formatPropertyValueIn,
  propertyNameOf as propertyNameIn,
} from "@vera/domain/properties";
import { interfaceLanguage } from "@/i18n/language";

export function propertyNameOf(definition: Pick<PropertyDefinition, "names">): string {
  return propertyNameIn(definition, interfaceLanguage());
}

export function enumValueNameOf(definition: PropertyDefinition, value: string): string {
  return enumValueNameIn(definition, value, interfaceLanguage());
}

export function formatPropertyValue(definition: PropertyDefinition, value: PropertyValue): string {
  return formatPropertyValueIn(definition, value, interfaceLanguage());
}
