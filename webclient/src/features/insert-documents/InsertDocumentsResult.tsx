import { Messages, MessagesMessage } from "primereact/messages";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { DocumentCreationStatus } from "../../types/DocumentCreationStatus";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";
import { DocumentCreationResponse } from "../../adapters/ApiDocuments";

interface InsertDocumentsResultProps {
    onRestart: () => void;
    onClose: () => void;
}

type MessageSeverity = 'success' | 'info' | 'warn' | 'error' | undefined;

const InsertDocumentsResult: React.FC<InsertDocumentsResultProps> = (props) => {
    const { t } = useTranslation();
    const { results } = useInsertDocuments();
    const messages = useRef(null);

    const generateMessage = (severity: MessageSeverity, header: string, text: string): MessagesMessage => {
        return {
            sticky: true,
            severity: severity,
            summary: header,
            detail: text,
            closable: false
        };
    };

    const getStatusSeverity = (status: DocumentCreationStatus): MessageSeverity => {
        if (status === DocumentCreationStatus.Success) {
            return "success";
        } else if (status === DocumentCreationStatus.UniqueDocumentViolation
                || status === DocumentCreationStatus.AlreadyDigitized) {
            return "warn";
        }
        return "error";
    };

    const getStatusTitle = (status: DocumentCreationStatus): string => {
        if (status === DocumentCreationStatus.Success) {
            return t('document_successfuly_created');
        }
        return t(status.toLowerCase());
    }

    const generateMessageForStatus = (results: DocumentCreationResponse[], status: DocumentCreationStatus) => {
        const documents = results.filter(result => result.create_result === status);
        if (documents.length === 0) {
            return null;
        }

        if (documents.length === 1) {
            const identifierName = documents[0].identifier.identifier_type.toLowerCase();
            const identifierValue = documents[0].identifier.value;
            return generateMessage(
                getStatusSeverity(status),
                getStatusTitle(status),
                `${t(identifierName)}: ${identifierValue}`
            );
        }
        return generateMessage(
            getStatusSeverity(status),
            getStatusTitle(status),
            `${t('count')}: ${documents.length}`
        );
    };

    useEffect(() => {
        if (messages.current) {
            const currentMessages: Messages = messages.current;
            currentMessages.clear();

            const newMessages: MessagesMessage[] = Object.values(DocumentCreationStatus)
                    .map(status => generateMessageForStatus(results, status))
                    .filter((message): message is MessagesMessage => message !== null);

            currentMessages.show(newMessages);
        }
    }, [results]);

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
