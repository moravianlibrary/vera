import React from "react";
import { MarcFieldDifference } from "../../adapters/ApiCatalogRecords";
import { useTranslation } from "react-i18next";
import MarcFieldDifferenceType from "../../types/MarcFieldDifferenceType";
import GeneralInformationDifference from "./marc-difference/GeneralInformationDifference";
import ExtraFieldDifference from "./marc-difference/ExtraFieldDifference";
import MissingFieldDifference from "./marc-difference/MissingFieldDifference";
import DifferentValueDifference from "./marc-difference/DifferentValueDifference";
import { Button } from "primereact/button";
import { useCatalogRecords } from "../../contexts/CatalogRecordsContext";
import { formatDatetime } from "../../data/factories/DateFactory";

interface CatalogRecordsDifferencesProps {
    difference: MarcFieldDifference;
}

const CatalogRecordsDifference: React.FC<CatalogRecordsDifferencesProps> = ({
    difference,
}) => {
    const { t } = useTranslation("catalog-records");
    const { approveDifference } = useCatalogRecords();

    const getDiffernceBody = () => {
        if (difference.tag === "008") {
            return <GeneralInformationDifference difference={difference} />;
        }
        switch (difference.difference_type) {
            case MarcFieldDifferenceType.ExtraField:
                return <ExtraFieldDifference difference={difference} />;
            case MarcFieldDifferenceType.MissingField:
                return <MissingFieldDifference difference={difference} />;
            case MarcFieldDifferenceType.DifferentValue:
                return <DifferentValueDifference difference={difference} />;
        }
    };

    const approvedLegend = () => {
        return (
            <div>
                <span className="font-bold">
                    {t("actions.difference-approved")}:
                </span>
                <span>{` ${difference.approved_by}, ${formatDatetime(
                    difference.approved_at!
                )}`}</span>
            </div>
        );
    };

    const approveButton = () => {
        return (
            <Button
                className="h-2rem"
                outlined
                rounded
                icon="pi pi-check"
                label={t("actions.action-approve-difference")}
                onClick={() => approveDifference(difference.id)}
            />
        );
    };

    return (
        <div className="flex justify-content-between align-items-center gap-2">
            <div
                className="flex flex-grow-1"
                style={{
                    fontFamily: "monospace",
                    whiteSpace: "pre",
                    border: "1px solid black",
                    borderRadius: "5px",
                    padding: "5px",
                    margin: "5px",
                }}
            >
                {getDiffernceBody()}
            </div>
            {(difference.approved_by && approvedLegend()) || approveButton()}
        </div>
    );
};

export default CatalogRecordsDifference;
