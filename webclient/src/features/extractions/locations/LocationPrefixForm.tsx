import React, { useState } from "react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Menu } from "primereact/menu";
import { Tooltip } from "primereact/tooltip";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Chip } from "primereact/chip";
import { Avatar } from "primereact/avatar";

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
    const { t } = useTranslation();

    const specialCharactersMenuRef = useRef<Menu>(null);

    const items = [
        {
            label: t("Special characters"),
            items: [
                {
                    label: t("Any digit"),
                    command: () => onChangePrefix(prefix + "[[:digit:]]"),
                },
                {
                    label: t("Any letter"),
                    command: () => onChangePrefix(prefix + "[[:alpha:]]"),
                },
                {
                    label: t("Any letter or digit"),
                    command: () => onChangePrefix(prefix + "[[:alnum:]]"),
                },
            ],
        },
    ];

    const parsePrefixToPattern = (prefix: string) => {
        return prefix
            .replace("[D]", "[[:digit:]]")
            .replace("[L]", "[[:alpha:]]")
            .replace("[X]", "[[:alnum:]]");
    };

    const parsePatternToPrefix = (prefix: string) => {
        return prefix
            .replace("[[:digit:]]", "[D]")
            .replace("[[:alpha:]]", "[L]")
            .replace("[[:alnum:]]", "[X]");
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
                content={t("Insert special character")}
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
