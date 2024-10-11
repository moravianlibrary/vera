import { useEffect, useState } from "react";

import { Button } from "primereact/button";
import { Panel } from "primereact/panel";

import { useTranslation } from "react-i18next";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import DocumentIssueCard from "./DocumentIssueCard";
import React from "react";
import { CatalogIssueResponse, Issue } from "../../adapters/ApiDocuments.js";
import { IssuanceType } from "../../types/IssuanceType";
import { Chip } from "primereact/chip";

interface InsertDocumentsIssuesProps {
    onGoBack?: () => void;
    onGoNext: () => void;
}

const naturalSort = (a, b) => {
    if (a === null) {
        return -1;
    }
    if (b === null) {
        return 1;
    }
    if (a === b) {
        return 0;
    }

    const numA = parseInt(a);
    const numB = parseInt(b);

    if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
    }

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const charCodeA = a.charCodeAt(i);
        const charCodeB = b.charCodeAt(i);

        if (!isNaN(charCodeA) && !isNaN(charCodeB)) {
            if (charCodeA !== charCodeB) {
                return charCodeA - charCodeB;
            }
        } else {
            return charCodeA - charCodeB;
        }
    }

    return a.length - b.length;
};

const InsertDocumentsIssues: React.FC<InsertDocumentsIssuesProps> = (props) => {
    const { responses, createIssue } = useInsertDocuments();
    const { t } = useTranslation();

    const [index, setIndex] = useState(0);
    const [editions, setEditions] = useState<CatalogIssueResponse[]>([]);
    const [volumes, setVolumes] = useState<CatalogIssueResponse[]>([]);
    const [bundles, setBundles] = useState<CatalogIssueResponse[]>([]);

    const handleChooseIssuesForDocument = (index) => {
        const catalogDocument = responses.MultipleIssues[index].document!;

        setEditions(
            catalogDocument.issues
                .filter((issue) => issue.issuance_type === IssuanceType.Unit)
                .sort((a, b) => naturalSort(a.barcode, b.barcode))
        );
        setVolumes(
            catalogDocument.issues
                .filter((issue) => issue.issuance_type === IssuanceType.Volume)
                .sort((a, b) => {
                    let value = naturalSort(a.volume, b.volume);
                    if (value === 0) {
                        let value = naturalSort(a.volume_year, b.volume_year);
                    }
                    return value;
                })
        );
        setBundles(
            catalogDocument.issues
                .filter((issue) => issue.issuance_type === IssuanceType.Bundle)
                .sort((a, b) => {
                    let value = naturalSort(a.volume, b.volume);
                    if (value === 0) {
                        value = naturalSort(a.volume_year, b.volume_year);
                    }
                    if (value === 0) {
                        value = naturalSort(a.bundle, b.bundle);
                    }
                    return value;
                })
        );
    };

    const handleClickIssue = (issue) => {
        createIssue(index, issue);
    };

    useEffect(() => {
        if (responses.MultipleIssues) {
            if (responses.MultipleIssues.length === 0) {
                props.onGoNext();
            }
            handleChooseIssuesForDocument(index);
        }
    }, [responses, index]);

    const getIssuesDiv = (header, issues) => {
        return (
            <Panel header={header} className="flex flex-column p-1">
                <div className="flex flex-wrap gap-1">
                    {issues.map((issue) => (
                        <DocumentIssueCard
                            key={issue.barcode}
                            issue={issue}
                            onClick={handleClickIssue}
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
                    <span>
                        {` ${responses.MultipleIssues[index].document!.title}`}
                    </span>
                </div>
                <div>
                    <span className="font-bold white-space-nowrap">
                        {t("System number")}:
                    </span>
                    <span>
                        {` ${responses.MultipleIssues[index].document!.sysno}`}
                    </span>
                </div>
            </div>
        );
    };

    const handleGoBack = () => {
        if (index === 0) {
            props.onGoBack!();
        } else {
            setIndex((prevIndex) => prevIndex - 1);
        }
    };

    const handleGoNext = () => {
        if (index === responses.MultipleIssues.length - 1) {
            props.onGoNext();
        } else {
            setIndex((prevIndex) => prevIndex + 1);
        }
    };

    const truncateText = (text: string) => {
        if (text.length > 50) {
            return text.slice(0, 50) + "...";
        } else {
            return text;
        }
    };

    const getGoBackLabel = () => {
        if (index === 0) {
            return t("Previous step");
        } else {
            return `${t("Previous document")} ${truncateText(
                responses.MultipleIssues[index - 1].document!.title
            )}`;
        }
    };

    const getGoNextLabel = () => {
        if (index === responses.MultipleIssues.length - 1) {
            return t("Next step");
        } else {
            return `${t("Next document")} \"${truncateText(
                responses.MultipleIssues[index + 1].document!.title
            )}\"`;
        }
    };

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
                <Button
                    className="overflown-ellipsis"
                    icon="pi pi-caret-left"
                    iconPos="left"
                    outlined
                    label={getGoBackLabel()}
                    onClick={handleGoBack}
                />
                {responses.MultipleIssues.length > 1 && (
                    <div className="flex px-5 gap-1">
                        <span className="font-bold">{`${t(
                            "Choose issues"
                        )}:`}</span>
                        <span>{`${index + 1} / ${
                            responses.MultipleIssues.length
                        }`}</span>
                    </div>
                )}
                <Button
                    className="overflown-ellipsis"
                    icon="pi pi-caret-right"
                    iconPos="right"
                    outlined
                    label={getGoNextLabel()}
                    onClick={handleGoNext}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsIssues;
