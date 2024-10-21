import { SelectItemOptionsType } from "primereact/selectitem";
import { IdentifierType } from "../../types/IdentifierType";
import { useTranslation } from "react-i18next";

export function IdentifierTypeSelectItems(): SelectItemOptionsType {
    const { t } = useTranslation("types");

    return Object.values(IdentifierType).map((i) => ({
        value: i,
        label: t(`identifier-type.${i.valueOf()}`),
    }));
}
