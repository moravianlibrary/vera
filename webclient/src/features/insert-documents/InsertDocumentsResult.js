import { Messages } from "primereact/messages";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { DocumentCreationStatus } from "../../types/DocumentCreationStatus";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";

const InsertDocumentsResult = (props) => {
    const { t } = useTranslation();
    const { results } = useInsertDocuments();
    const messages = useRef(null);

    const handleRestart = () => {
        if (props.onRestart) {
            props.onRestart();
        }
    }

    const handleClose = () => {
        if (props.onClose) {
            props.onClose();
        }
    }

    const generateMessage = (severity, header, text) => {
        return {
            sticky: true,
            severity: severity,
            summary: header,
            detail: text,
            closable: false
        };
    };

    const getStatusSeverity = (status) => {
        if (status === DocumentCreationStatus.Success) {
            return "success";
        } else if (status === DocumentCreationStatus.UniqueDocumentViolation
                || status === DocumentCreationStatus.AlreadyDigitized) {
            return "warn";
        }
        return "error";
    };

    const getStatusTitle = (status) => {
        if (status === DocumentCreationStatus.Success) {
            return t('document_successfuly_created');
        }
        return t(status.toLowerCase());
    }

    const generateMessageForStatus = (results, status) => {
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
            messages.current.clear();

            const newMessages = Object.values(DocumentCreationStatus)
            .map(status => generateMessageForStatus(results, status))
            .filter(message => message !== null);

            messages.current.show(newMessages);
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
                    onClick={handleRestart}
                />
                <Button
                    disabled
                    icon="pi pi-question"
                    outlined
                    label={t('details')}
                    onClick={handleRestart}
                />
                <Button
                    icon="pi pi-times"
                    iconPos="left"
                    outlined
                    label={t('finish')}
                    onClick={handleClose}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsResult;
