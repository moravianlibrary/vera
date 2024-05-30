import { useTranslation } from "react-i18next";
import { Intention } from "../../adapters/ApiCategories";
import { Dropdown } from "primereact/dropdown";
import React, { useEffect } from "react";
import { useIntentions } from "../../contexts/categories/IntentionsContext";

interface IntentionPickerProps {
    selectedIntention: Intention | undefined;
    onIntentionChange: (quota: Intention | undefined) => void;
    useActive?: boolean;
    disabled?: boolean;
    className?: string;
}

const IntentionPicker: React.FC<IntentionPickerProps> = (props) => {
    const { t } = useTranslation();
    const { intentions, activeIntention } = useIntentions();

    useEffect(() => {
        if (props.useActive) {
            props.onIntentionChange(activeIntention);
        }
    }, [props.useActive]);

    return (
        <div className={`flex flex-column ${props.className}`}>
            <Dropdown
                disabled={props.disabled}
                value={props.selectedIntention}
                options={intentions}
                optionLabel="name"
                optionValue="id"
                onChange={(e) => props.onIntentionChange(e.value)}
                placeholder={t("Select quota")}
            />
        </div>
    );
};

export default IntentionPicker;
