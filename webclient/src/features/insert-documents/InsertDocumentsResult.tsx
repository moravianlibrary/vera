import { Messages } from "primereact/messages";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";

interface InsertDocumentsResultProps {
    onRestart: () => void;
    onClose: () => void;
}

const InsertDocumentsResult: React.FC<InsertDocumentsResultProps> = (props) => {
    const { t } = useTranslation();
    const { result } = useInsertDocuments();
    const messages = useRef(null);

    useEffect(() => {
        if (messages.current) {
            const currentMessages: Messages = messages.current;
            currentMessages.clear();
            currentMessages.show(result.getMessages(t));
        }
    }, [result]);

    return (
        <div>
            <Messages ref={messages} />
            <div className="flex justify-content-between gap-3">
                <Button
                    icon="pi pi-replay"
                    outlined
                    label={t('insert_another')}
                    onClick={() => props.onRestart()}
                />
                <Button
                    disabled
                    icon="pi pi-question"
                    outlined
                    label={t('details')}
                    onClick={() => props.onRestart()}
                />
                <Button
                    icon="pi pi-times"
                    iconPos="left"
                    outlined
                    label={t('finish')}
                    onClick={() => props.onClose()}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsResult;
