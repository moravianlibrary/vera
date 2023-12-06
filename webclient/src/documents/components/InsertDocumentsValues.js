import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const InsertDocumentsValues = (props) => {
    const { t } = useTranslation();

    const identifierName = props.identifierName;
    const [value, setValue] = useState("");

    const handleKeyPress = (event) => {
        if (event.key === 'Enter' && props.onAccept) {
            props.onAccept({ value: value });
        }
    };

    const handleGoBack = () => {
        if (props.onGoBack) {
            props.onGoBack();
        }
    }

    return (
        <div className="flex flex-column gap-5">
            <div className="flex align-items-center gap-2">
                <span>{t(identifierName)}:</span>
                <InputText
                    autoFocus
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                />
            </div>
            <Button
                icon="pi pi-caret-left"
                outlined
                label={t('prev_step')}
                onClick={handleGoBack}
            />
        </div>
    );
};

export default InsertDocumentsValues;
