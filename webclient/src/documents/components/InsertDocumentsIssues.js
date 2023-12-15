import { useEffect, useState } from "react";

import { Button } from "primereact/button";
import { Panel } from 'primereact/panel';

import CreateResult from "../models/CreateResult";
import DigitizationState from "../models/DigitizationState";
import IssuanceType from "../models/IssuanceType";
import naturalSort from "../SortUtils";
import { useTranslation } from "react-i18next";
import { ProgressSpinner } from "primereact/progressspinner";
import { ProgressBar } from "primereact/progressbar";
import { ScrollPanel } from "primereact/scrollpanel";

const InsertDocumentsIssues = (props) => {
    const { t } = useTranslation();

    const [editions, setEditions] = useState([]);
    const [volumes, setVolumes] = useState([]);

    const handleGoBack = (e) => {
        if (props.onGoBack) {
            props.onGoBack();
        }
    };

    const handleNext = (e) => {
        if (props.onNext) {
            props.onNext();
        }
    };

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

    const IssueDiv = (props) => {
        const issue = props.issue;
        const [creating, setCreating] = useState(issue.creating);

        const active = !issue.already_exists && issue.digitization_state == DigitizationState.NOT_DIGITIZED;
        const state = issue.already_exists ? t('document_already_exists')
                : issue.digitization_state == DigitizationState.FINISHED ? t('digitization_finished')
                : null;
        
        const handleClick = (e) => {
            setCreating(true);
            handleClickIssue(issue);
        };

        return (
            <Button className="flex flex-1 overflow-visible text-gray-800" outlined
                disabled={!active}
                onClick={handleClick}
            >
                <div className="flex flex-column flex-1 align-items-start">
                    {creating && <ProgressBar mode="indeterminate" style={{ height: '6px', width: '100%' }} />}
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
                    {issues.map(issue => <IssueDiv issue={issue}/>)}
                </div>
            </Panel>
        );
    };

    return (
        <div>
            <div className="flex flex-column overflow-auto" style={{height: 'calc(100vh - 430px)'}}>
                {editions && editions.length > 0 &&
                getIssuesDiv("Edice", editions)}
                {volumes && volumes.length > 0 &&
                getIssuesDiv("Rocniky", volumes)}
            </div>
            <div className="flex justify-content-between p-1">
                <Button
                    icon="pi pi-caret-left"
                    iconPos="left"
                    outlined
                    label={t('prev_step')}
                    onClick={handleGoBack}
                />
                <Button
                    icon="pi pi-caret-right"
                    iconPos="right"
                    outlined
                    label={t('next_step')}
                    onClick={handleNext}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsIssues;
