import { useEffect, useState } from "react";

import { Button } from "primereact/button";
import { Panel } from 'primereact/panel';

import CreateResult from "../models/CreateResult";
import DigitizationState from "../models/DigitizationState";
import IssuanceType from "../models/IssuanceType";
import naturalSort from "../SortUtils";
import { useTranslation } from "react-i18next";

const InsertDocumentsIssues = (props) => {
    const { t } = useTranslation();

    const [editions, setEditions] = useState([]);
    const [volumes, setVolumes] = useState([]);

    const handleClickIssue = (issue) => {
        if (props.onSelect) {
            props.onSelect(issue);
        }
    };

    useEffect(() => {
        if (!props.data || props.data.lenght == 0 || !props.data[0]) {
            return;
        }

        const catalogDocument = props.data[0].catalog_document;

        setEditions(catalogDocument.issues
            .filter(issue => issue.issuance_type == IssuanceType.EDITION));
        setVolumes(catalogDocument.issues
            .filter(issue => issue.issuance_type == IssuanceType.VOLUME)
            .sort((a, b) => naturalSort(a.volume, b.volume)));
    }, [props.data]);

    const getIssueDiv = (issue) => {
        const active = !issue.already_exists && issue.digitization_state == DigitizationState.NOT_DIGITIZED;
        const state = issue.already_exists ? t('document_already_exists')
                : issue.digitization_state == DigitizationState.FINISHED ? t('digitization_finished')
                : null;

        return (
            <Button className="flex flex-1 overflow-visible text-gray-800" outlined
                disabled={!active}
                onClick={e => handleClickIssue(issue)}
            >
                <div className="flex flex-column flex-1 align-items-start">
                    {state && <span className="font-bold text-lg">{state}</span>}
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
            </Button>
        );
    };

    const getIssuesDiv = (header, issues) => {
        return (
            <Panel header={header} className="flex flex-column p-1">
                <div className="flex flex-wrap gap-1" >
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
