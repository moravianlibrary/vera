import { useTranslation } from "react-i18next";
import { Quota } from "../adapters/ApiCategories";
import { useQuotas } from "../contexts/categories/QuotasContext";
import { Dropdown } from "primereact/dropdown";
import React, { useEffect } from "react";

interface QuotaPickerProps {
    selectedQuota: Quota | undefined;
    onQuotaChange: (quota: Quota | undefined) => void;
    useActive?: boolean;
    disabled?: boolean;
    className?: string;
}

const QuotaPicker: React.FC<QuotaPickerProps> = (props) => {
    const { t } = useTranslation();
    const { quotas, selectedQuota: defaultQuota } = useQuotas();

    useEffect(() => {
        if (props.useActive) {
            props.onQuotaChange(defaultQuota);
        }
    }, [props.useActive]);

    return (
        <div className={`flex flex-column ${props.className}`}>
            <Dropdown
                disabled={props.disabled}
                value={props.selectedQuota}
                options={quotas}
                optionLabel="name"
                optionValue="id"
                onChange={(e) => props.onQuotaChange(e.value)}
                placeholder={t('Select quota')}
            />
        </div>
    );   
}

export default QuotaPicker;
