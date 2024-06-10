import { useEffect, useState } from "react";

import { Button } from "primereact/button";
import { Panel } from "primereact/panel";

import { useTranslation } from "react-i18next";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import DocumentIssueCard from "./DocumentIssueCard";
import React from "react";
import { Issue } from "../../adapters/ApiDocuments.js";
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
    const { chooseIssuesDocuments, createIssue } = useInsertDocuments();
    const { t } = useTranslation();

    const [index, setIndex] = useState(0);
    const [editions, setEditions] = useState<Issue[]>([]);
    const [volumes, setVolumes] = useState<Issue[]>([]);
    const [bundles, setBundles] = useState<Issue[]>([]);

    const handleChooseIssuesForDocument = (index) => {
        const catalogDocument = chooseIssuesDocuments[index].catalog_document!;

        setEditions(
            catalogDocument.issues
                .filter((issue) => issue.type === IssuanceType.Unit)
                .sort((a, b) => a.barcode.localeCompare(b.barcode))
        );
        setVolumes(
            catalogDocument.issues
                .filter((issue) => issue.type === IssuanceType.Volume)
                .sort((a, b) => {
                    let value = naturalSort(a.volume, b.volume);
                    if (value === 0) {
                        let value = naturalSort(a.year, b.year);
                    }
                    return value;
                })
        );
        setBundles(
            catalogDocument.issues
                .filter((issue) => issue.type === IssuanceType.Bundle)
                .sort((a, b) => {
                    let value = naturalSort(a.volume, b.volume);
                    if (value === 0) {
                        value = naturalSort(a.year, b.year);
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
        if (chooseIssuesDocuments) {
            if (chooseIssuesDocuments.length === 0) {
                props.onGoNext();
            }
            handleChooseIssuesForDocument(index);
        }
    }, [chooseIssuesDocuments, index]);

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
                        {` ${
                            chooseIssuesDocuments[index].catalog_document!.title
                        }`}
                    </span>
                </div>
                <div>
                    <span className="font-bold white-space-nowrap">
                        {t("System number")}:
                    </span>
                    <span>
                        {` ${
                            chooseIssuesDocuments[index].catalog_document!.sysno
                        }`}
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
        if (index === chooseIssuesDocuments.length - 1) {
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
                chooseIssuesDocuments[index - 1].catalog_document!.title
            )}`;
        }
    };

    const getGoNextLabel = () => {
        if (index === chooseIssuesDocuments.length - 1) {
            return t("Next step");
        } else {
            return `${t("Next document")} \"${truncateText(
                chooseIssuesDocuments[index + 1].catalog_document!.title
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
                {chooseIssuesDocuments.length > 1 && (
                    <div className="flex px-5 gap-1">
                        <span className="font-bold">{`${t(
                            "Choose issues"
                        )}:`}</span>
                        <span>{`${index + 1} / ${
                            chooseIssuesDocuments.length
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
