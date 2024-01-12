import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { ProgressBar } from "primereact/progressbar";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const InsertDocumentsValues = (props) => {
    const { t } = useTranslation();

    const identifierName = props.identifierName;
    const [value, setValue] = useState("");
    const [accepted, setAccepted] = useState(false);

    const handleKeyPress = (event) => {
        if (event.key === 'Enter' && props.onAccept) {
            setAccepted(true);
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
            {accepted && <ProgressBar mode="indeterminate" style={{ height: '6px', width: '100%' }} />}
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
