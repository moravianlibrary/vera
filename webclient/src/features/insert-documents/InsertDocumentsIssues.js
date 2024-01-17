import { useEffect, useState } from "react";

import { Button } from "primereact/button";
import { Panel } from 'primereact/panel';

import { useData } from "../../services/Data.js";
import CreateResult from "../../documents/models/CreateResult.js";
import DigitizationState from "../../documents/models/DigitizationState.js";
import IssuanceType from "../../documents/models/IssuanceType.js";
import naturalSort from "../../documents/SortUtils.js";
import { useTranslation } from "react-i18next";
import { ProgressSpinner } from "primereact/progressspinner";
import { ProgressBar } from "primereact/progressbar";
import { ScrollPanel } from "primereact/scrollpanel";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext.js";

const InsertDocumentsIssues = (props) => {
    const { dataService } = useData();
    const { chooseIssuesDocuments, createIssue, creatingIssues, createdIssues } = useInsertDocuments();
    const { t } = useTranslation();

    const [index, setIndex] = useState(0);
    const [editions, setEditions] = useState([]);
    const [volumes, setVolumes] = useState([]);

    const handleGoBack = (e) => {
        if (props.onGoBack) {
            props.onGoBack();
        }
    };

    const handleGoNext = (e) => {
        if (props.onGoNext) {
            props.onGoNext();
        }
    };

    const handleChooseIssuesForDocument = (index) => {
        const catalogDocument = chooseIssuesDocuments[index].catalog_document;

        setEditions(catalogDocument.issues
            .filter(issue => issue.issuance_type === IssuanceType.EDITION));
        setVolumes(catalogDocument.issues
            .filter(issue => issue.issuance_type === IssuanceType.VOLUME)
            .sort((a, b) => naturalSort(a.volume, b.volume)));
    };

    const handleClickIssue = (issue) => {
        createIssue(index, issue);
    };

    useEffect(() => {
        if (chooseIssuesDocuments) {
            if (chooseIssuesDocuments.length === 0) {
                handleGoNext();
            }
            handleChooseIssuesForDocument(index);
        }
        // dataService.subscribe('multiIssueDocumentsChanged', handleMultiIssueDocumentsChanged);

        // handleMultiIssueDocumentsChanged();
    }, [chooseIssuesDocuments]);

    const IssueDiv = (props) => {
        const issue = props.issue;

    const active = !issue.already_exists && issue.digitization_state === DigitizationState.NOT_DIGITIZED;
        const [state, setState] = useState(issue.already_exists
                ? t('document_already_exists')
                : issue.digitization_state === DigitizationState.FINISHED
                    ? t('digitization_finished')
                    : null);
        const [creating, setCreating] = useState(false);
        const [created, setCreated] = useState(false);
        
        const handleClick = (e) => {
            handleClickIssue(issue);
        };

        useEffect(() => {
            if (creatingIssues && !issue.already_exists && !created && creatingIssues.filter(i => i.barcode === issue.barcode).length > 0) {
                setCreating(true);
            }
        }, [creatingIssues]);

        useEffect(() => {
            if (createdIssues && !issue.already_exists && createdIssues.filter(i => i.barcode === issue.barcode).length > 0) {
                setCreated(true);
                setState(t('document_already_exists'));
                // setCreating(false);
            }
        }, [createdIssues]);

        useEffect(() => {
            if (created) {
                setCreating(false);
            }
            // if (issue.already_exists || createdIssues.filter(i => i.barcode === issue.barcode).length > 0) {
            //     setCreated(true);
            //     setState(t('document_already_exists'));
            // }
        }, [created]);

        return (
            <Button className="flex flex-1 overflow-visible text-gray-800" outlined
                disabled={!active || createdIssues.filter(i => i.barcode === issue.barcode).length > 0}
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
                    {issues.map(issue => <IssueDiv key={issue.barcode} issue={issue}/>)}
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
                    onClick={handleGoNext}
                />
            </div>
        </div>
    );
};

export default InsertDocumentsIssues;
