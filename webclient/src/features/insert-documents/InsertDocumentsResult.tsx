import { Messages } from "primereact/messages";
import { useEffect, useRef, useState } from "react";
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
    const { result, insertAnother } = useInsertDocuments();
    const messages = useRef(null);
    const [countdown, setCountdown] = useState(3);

    useEffect(() => {
        if (messages.current) {
            const currentMessages: Messages = messages.current;
            currentMessages.clear();
            currentMessages.show(result.getMessages(t));
        }
        if (insertAnother && result.isSuccessful()) {
            const timer = setInterval(() => {
                setCountdown((prevCountdown) => prevCountdown - 1);
            }, 1000);
        }
    }, [result]);

    useEffect(() => {
        console.log(countdown);
        if (countdown <= 0) {
            props.onRestart();
        }
    }, [countdown]);

    const getInsertAnotherLabel = () => {
        return insertAnother && result.isSuccessful()
            ? `${t("insert_another")} (${countdown}s)`
            : t("insert_another");
    };

    return (
        <div>
            <Messages ref={messages} />
            <div className="flex justify-content-between gap-3">
                <Button
                    icon="pi pi-replay"
                    outlined
                    label={getInsertAnotherLabel()}
                    onClick={() => props.onRestart()}
                />
                <Button
                    disabled
                    icon="pi pi-question"
                    outlined
                    label={t("details")}
                    onClick={() => props.onRestart()}
                />
                <Button
                    icon="pi pi-times"
                    iconPos="left"
                    outlined
                    label={t("finish")}
                    onClick={() => props.onClose()}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsResult;
