import React from "react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Menu } from "primereact/menu";
import { Tooltip } from "primereact/tooltip";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

interface LocationPrefixFormProps {
    prefix: string;
    onChangePrefix: (prefix: string) => void;
    disabled?: boolean;
}

const LocationPrefixForm: React.FC<LocationPrefixFormProps> = ({
    prefix,
    onChangePrefix,
    disabled,
}) => {
    const { t } = useTranslation("locations");

    const specialCharactersMenuRef = useRef<Menu>(null);

    const items = [
        {
            label: t("form.special-characters.label"),
            items: [
                {
                    label: t("form.special-characters.any-digit"),
                    command: () => onChangePrefix(prefix + "[[:digit:]]"),
                },
                {
                    label: t("form.special-characters.any-letter"),
                    command: () => onChangePrefix(prefix + "[[:alpha:]]"),
                },
                {
                    label: t("form.special-characters.any-letter-or-digit"),
                    command: () => onChangePrefix(prefix + "[[:alnum:]]"),
                },
            ],
        },
    ];

    const parsePrefixToPattern = (prefix) => {
        return prefix
            .replace(/\[D\]/g, "[[:digit:]]")
            .replace(/\[L\]/g, "[[:alpha:]]")
            .replace(/\[X\]/g, "[[:alnum:]]");
    };

    const parsePatternToPrefix = (prefix) => {
        return prefix
            .replace(/\[\[:digit:\]\]/g, "[D]")
            .replace(/\[\[:alpha:\]\]/g, "[L]")
            .replace(/\[\[:alnum:\]\]/g, "[X]");
    };

    return (
        <div className="flex p-inputgroup">
            <InputText
                value={parsePatternToPrefix(prefix)}
                onChange={(e) =>
                    onChangePrefix(parsePrefixToPattern(e.target.value))
                }
                disabled={disabled}
            />
            <Tooltip
                target=".pi-hashtag"
                content={t("form.placeholder.special-characters")}
                position="top"
            />
            <Menu
                ref={specialCharactersMenuRef}
                popup
                popupAlignment="right"
                model={items}
            />
            <Button
                icon="pi pi-hashtag"
                outlined
                onClick={(event) =>
                    specialCharactersMenuRef.current?.toggle(event)
                }
                disabled={disabled}
            />
        </div>
    );
};

export default LocationPrefixForm;
