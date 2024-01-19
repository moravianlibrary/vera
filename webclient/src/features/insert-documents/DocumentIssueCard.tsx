import React, { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { ProgressBar } from "primereact/progressbar";
import { useTranslation } from "react-i18next";
import { Issue } from "../../adapters/ApiDocuments";
import { DigitizationState } from "../../types/DigitizationState";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";

interface IssueDivProps {
    issue: Issue;
    onClick: (issue: Issue) => void;
}

const DocumentIssueCard: React.FC<IssueDivProps> = ({ issue, onClick }) => {
    const { t } = useTranslation();
    const { creatingIssues, createdIssues } = useInsertDocuments();
    
    const active = !issue.already_exists && issue.digitization_state === DigitizationState.NotDigitized;
    const [state, setState] = useState(issue.already_exists
            ? t('document_already_exists')
            : issue.digitization_state === DigitizationState.Finished
                ? t('digitization_finished')
                : null);
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState(false);
    
    const handleClick = () => {
        onClick(issue);
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
                {issue.volume && <div className="flex gap-1">
                    <span className="font-bold white-space-nowrap">{t('volume')}:</span>
                    <span>{issue.volume}</span>
                </div>}
                {issue.year_issued && <div className="flex gap-1">
                    <span className="font-bold white-space-nowrap">{t('year_issued')}:</span>
                    <span>{issue.year_issued}</span>
                </div>}
            </div>
        </Button>
    );
};

export default DocumentIssueCard;
