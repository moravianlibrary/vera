import { Messages, MessagesMessage } from "primereact/messages";
import React, { useEffect, useRef } from "react";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import AddDocumentResponseStatus from "../../types/AddDocumentResponseStatus";
import { useTranslation } from "react-i18next";
import { CatalogDocumentResponse } from "../../adapters/ApiDocuments";
import { IssuanceType } from "../../types/IssuanceType";
import { MaterialType } from "../../types/MaterialType";
import {
    getResponseMessageSeverity,
    getResultDetail,
} from "./InsertDocumentsFunctions";

interface AddDocumentResultsMessagesProps {}

const AddDocumentResultsMessages: React.FC<
    AddDocumentResultsMessagesProps
> = ({}) => {
    const { t } = useTranslation();
    const { responses, withoutPageCount } = useInsertDocuments();

    const messages = useRef<Messages>(null);

    useEffect(() => {
        if (!messages.current) return;

        const displayMessages: MessagesMessage[] = Object.values(
            AddDocumentResponseStatus
        )
            .filter((s) => responses[s].length > 0)
            .map((s) => ({
                severity: getResponseMessageSeverity(s),
                summary: t(`documents.add.results.status.${s}`, {
                    count: responses[s].length,
                }),
                detail:
                    responses[s].length === 1 &&
                    responses[s][0].document &&
                    getResultDetail(responses[s][0].document),
                sticky: true,
                closable: false,
            }));
        if (withoutPageCount.length > 0) {
            displayMessages.push({
                severity: "info",
                summary: t("documents.add.results.status.without-page-count", {
                    count: withoutPageCount.length,
                }),
                sticky: true,
                closable: false,
            });
        }

        messages.current.replace(displayMessages);
    }, [responses, withoutPageCount]);

    return <Messages ref={messages} />;
};

export default AddDocumentResultsMessages;
