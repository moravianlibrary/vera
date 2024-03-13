import { IdentifierType } from "./IdentifierType";

export interface LabeledIdentifier {
    value: IdentifierType;
    label: string;
}

export const identifiers: LabeledIdentifier[] = [
    {
        value: IdentifierType.Sysno,
        label: "System number",
    },
    {
        value: IdentifierType.Barcode,
        label: "Barcode",
    },
    {
        value: IdentifierType.Signature,
        label: "Signature",
    },
];

export function getLocalizedIdentifiers(t): LabeledIdentifier[] {
    return identifiers.map((i) => ({
        value: i.value,
        label: t(i.label),
    }));
}

export function getIdentifierTypeLabel(type: IdentifierType) {
    return identifiers.find((i) => i.value === type)!.label;
}
