import { useEffect, useState } from "react";

import { Panel } from 'primereact/panel';

import CreateResult from "../models/CreateResult";
import IssuanceType from "../models/IssuanceType";
import { useTranslation } from "react-i18next";

const InsertDocumentsIssues = (props) => {
    const { t } = useTranslation();

    const [editions, setEditions] = useState([]);
    const [volumes, setVolumes] = useState([]);

    const handleClickIssue = (issue) => {
        console.log(issue);
    };

    useEffect(() => {
        if (!props.results) {
            return;
        }
        const chooseIssueDocuments = props.results
                .filter(result => result.create_result == CreateResult.MULTIPLE_ISSUE_CHOICES);
        if (!chooseIssueDocuments || chooseIssueDocuments.lenght == 0 || !chooseIssueDocuments[0]) {
            return;
        }

        const catalogDocument = chooseIssueDocuments[0].catalog_document

        setEditions(catalogDocument.issues
            .filter(issue => issue.issuance_type == IssuanceType.EDITION));
        setVolumes(catalogDocument.issues
            .filter(issue => issue.issuance_type == IssuanceType.VOLUME)
            .sort((a, b) => (a.volume < b.volume) ? -1 : (a.volume > b.volume) ? 1 : 0));
    }, [props.results]);

    const getIssueDiv = (issue) => {
        return (
            <div className="flex flex-column flex-1 p-3 border-2 surface-border surface-card border-round"
                style={{ cursor: 'pointer', margin: '2px' }}
                onClick={e => handleClickIssue(issue)}
            >
                {issue.signature && <div className="flex gap-1">
                    <span className="font-bold">{t('signature')}:</span>
                    <span>{issue.signature}</span>
                </div>}
                {issue.barcode && <div className="flex gap-1">
                    <span className="font-bold white-space-nowrap">{t('barcode')}:</span>
                    <span>{issue.barcode}</span>
                </div>}
                {issue.yearIssued && <div className="flex gap-1">
                    <span className="font-bold white-space-nowrap">{t('year_issued')}:</span>
                    <span>{issue.yearIssued}</span>
                </div>}
                {issue.volume && <div className="flex gap-1">
                    <span className="font-bold white-space-nowrap">{t('volume')}:</span>
                    <span>{issue.volume}</span>
                </div>}
            </div>
        );
    };

    const getIssuesDiv = (header, issues) => {
        return (
            <Panel header={header} className="flex flex-column p-1">
                <div className="flex flex-wrap" >
                    {issues.map(issue => (getIssueDiv(issue)))}
                </div>
            </Panel>
        );
    };

    return (
        <div>
            {editions && editions.length > 0 &&
            getIssuesDiv("Edice", editions)}
            {volumes && volumes.length > 0 &&
            getIssuesDiv("Rocniky", volumes)}
        </div>
    );
};

export default InsertDocumentsIssues;
