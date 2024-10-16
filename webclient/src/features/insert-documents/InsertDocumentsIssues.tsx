import { useEffect, useState } from "react";

import { Button } from "primereact/button";
import { Panel } from "primereact/panel";

import { useTranslation } from "react-i18next";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import DocumentIssueCard from "./DocumentIssueCard";
import React from "react";
import { Chip } from "primereact/chip";

interface InsertDocumentsIssuesProps {}

const InsertDocumentsIssues: React.FC<InsertDocumentsIssuesProps> = () => {
    const {
        currIssuesDocument,
        nextIssuesDocument,
        prevIssuesDocument,
        currIndex,
        totalCountIssuesDocuments,
        editions,
        volumes,
        bundles,
        createIssue,
        goToNextStep,
        goToPrevStep,
    } = useInsertDocuments();
    const { t } = useTranslation();

    const getIssuesDiv = (header, issues) => {
        return (
            <Panel header={header} className="flex flex-column p-1">
                <div className="flex flex-wrap gap-1">
                    {issues.map((issue) => (
                        <DocumentIssueCard
                            key={issue.barcode}
                            issue={issue}
                            onClick={() => createIssue(issue)}
                        />
                    ))}
                </div>
            </Panel>
        );
    };

    const getDocumentHeader = () => {
        return (
            <div className="flex flex-column overflown-ellipsis p-1">
                <div>
                    <span className="font-bold white-space-nowrap">
                        {t("Title")}:
                    </span>
                    <span>{` ${currIssuesDocument!.title}`}</span>
                </div>
                <div>
                    <span className="font-bold white-space-nowrap">
                        {t("System number")}:
                    </span>
                    <span>{` ${currIssuesDocument!.sysno}`}</span>
                </div>
            </div>
        );
    };

    const truncateText = (text: string) => {
        if (text.length > 50) {
            return text.slice(0, 50) + "...";
        } else {
            return text;
        }
    };

    const getGoBackLabel = () => {
        if (prevIssuesDocument) {
            return `${t("Previous document")} ${truncateText(
                prevIssuesDocument.title
            )}`;
        } else {
            return t("Previous step");
        }
    };

    const getGoNextLabel = () => {
        if (nextIssuesDocument) {
            return `${t("Next document")} \"${truncateText(
                nextIssuesDocument.title
            )}\"`;
        } else {
            return t("Next step");
        }
    };

    if (!currIssuesDocument) return null;

    return (
        <div className="flex flex-column">
            <Chip className="m-1 p-2" template={getDocumentHeader()} />
            <div
                className="flex flex-column overflow-auto"
                style={{ maxHeight: "calc(100vh - 500px)" }}
            >
                {editions &&
                    editions.length > 0 &&
                    getIssuesDiv("Edice", editions)}
                {volumes &&
                    volumes.length > 0 &&
                    getIssuesDiv("Rocniky", volumes)}
                {bundles &&
                    bundles.length > 0 &&
                    getIssuesDiv("Svazky cisel", bundles)}
            </div>
            <div className="flex justify-content-between align-items-center p-1">
                {(currIndex > 0 && (
                    <Button
                        className="overflown-ellipsis"
                        icon="pi pi-caret-left"
                        iconPos="left"
                        outlined
                        label={getGoBackLabel()}
                        onClick={goToPrevStep}
                    />
                )) || <div></div>}
                {totalCountIssuesDocuments > 1 && (
                    <div className="flex px-5 gap-1">
                        <span className="font-bold">{`${t(
                            "Choose issues"
                        )}:`}</span>
                        <span>{`${
                            currIndex + 1
                        } / ${totalCountIssuesDocuments}`}</span>
                    </div>
                )}
                <Button
                    className="overflown-ellipsis"
                    icon="pi pi-caret-right"
                    iconPos="right"
                    outlined
                    label={getGoNextLabel()}
                    onClick={goToNextStep}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsIssues;
