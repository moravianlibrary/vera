import { useEffect, useState } from "react";

import { Button } from "primereact/button";
import { Panel } from 'primereact/panel';

import naturalSort from "../../documents/SortUtils.js";
import { useTranslation } from "react-i18next";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import DocumentIssueCard from "./DocumentIssueCard";
import React from "react";
import { Issue } from "../../adapters/ApiDocuments.js";
import { IssuanceType } from "../../types/IssuanceType";

interface InsertDocumentsIssuesProps {
    onGoBack?: () => void;
    onGoNext: () => void;
}

const InsertDocumentsIssues: React.FC<InsertDocumentsIssuesProps> = (props) => {
    const { chooseIssuesDocuments, createIssue } = useInsertDocuments();
    const { t } = useTranslation();

    const [index, setIndex] = useState(0);
    const [editions, setEditions] = useState<Issue[]>([]);
    const [volumes, setVolumes] = useState<Issue[]>([]);
    const [bundles, setBundles] = useState<Issue[]>([]);

    const handleChooseIssuesForDocument = (index) => {
        const catalogDocument = chooseIssuesDocuments[index].catalog_document!;

        setEditions(catalogDocument.issues
            .filter(issue => issue.type === IssuanceType.Unit));
        setVolumes(catalogDocument.issues
            .filter(issue => issue.type === IssuanceType.Volume)
            .sort((a, b) => naturalSort(a.volume, b.volume)));
        setBundles(catalogDocument.issues
            .filter(issue => issue.type === IssuanceType.Bundle)
            .sort((a, b) => naturalSort(a.volume, b.volume)));
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
    }, [chooseIssuesDocuments]);

    const getIssuesDiv = (header, issues) => {
        return (
            <Panel header={header} className="flex flex-column p-1">
                <div className="flex flex-wrap gap-1" >
                    {issues.map(issue => <DocumentIssueCard key={issue.barcode} issue={issue} onClick={handleClickIssue}/>)}
                </div>
            </Panel>
        );
    };

    return (
        <div>
            <div className="flex flex-column overflow-auto" style={{maxHeight: 'calc(100vh - 430px)'}} >
                {editions && editions.length > 0 &&
                getIssuesDiv("Edice", editions)}
                {volumes && volumes.length > 0 &&
                getIssuesDiv("Rocniky", volumes)}
                {bundles && bundles.length > 0 &&
                getIssuesDiv("Svazky cisel", bundles)}
            </div>
            <div className="flex justify-content-between p-1">
                <Button
                    icon="pi pi-caret-left"
                    iconPos="left"
                    outlined
                    label={t('prev_step')}
                    onClick={props.onGoBack}
                />
                <Button
                    icon="pi pi-caret-right"
                    iconPos="right"
                    outlined
                    label={t('next_step')}
                    onClick={props.onGoNext}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsIssues;
