import { Messages, MessagesMessage } from "primereact/messages";
import React, { useEffect, useRef } from "react";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import AddDocumentResponseStatus from "../../types/AddDocumentResponseStatus";
import { useTranslation } from "react-i18next";
import { AddDocumentResponse } from "../../adapters/ApiDocuments";
import {
    getResponseMessageSeverity,
    getResultDetail,
} from "./InsertDocumentsFunctions";

interface AddDocumentResultsMessagesProps {}

const AddDocumentResultsMessages: React.FC<
    AddDocumentResultsMessagesProps
> = ({}) => {
    const { t } = useTranslation("types");
    const { responses, withoutPageCount } = useInsertDocuments();

    const messages = useRef<Messages>(null);

    useEffect(() => {
        if (!messages.current) return;

        const perStatusSummary = responses.reduce<
            Record<string, AddDocumentResponse | number>
        >((acc, response) => {
            const status = response.status;
            if (!acc[status]) {
                acc[status] = response;
            } else if (acc[status] instanceof Object) {
                acc[status] = 2;
            } else if (typeof acc[status] === "number") {
                acc[status] = (acc[status] as number) + 1;
            }
            return acc;
        }, {});

        const displayMessages: MessagesMessage[] = Object.values(
            AddDocumentResponseStatus
        )
            .filter((s) => perStatusSummary[s])
            .map((s) => ({
                severity: getResponseMessageSeverity(s),
                summary: t(`add-documents-response-status.${s}`, {
                    count:
                        perStatusSummary[s] instanceof Object
                            ? 1
                            : (perStatusSummary[s] as number),
                }),
                detail:
                    perStatusSummary[s] instanceof Object &&
                    getResultDetail(
                        (perStatusSummary[s] as AddDocumentResponse).document!
                    ),
                sticky: true,
                closable: false,
            }));
        if (withoutPageCount.length > 0) {
            displayMessages.push({
                severity: "info",
                summary: t("add-documents-response-status.without-page-count", {
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
