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

interface CatalogRecordsDifferencesProps {
    difference: MarcFieldDifference;
}

const CatalogRecordsDifference: React.FC<CatalogRecordsDifferencesProps> = ({
    difference,
}) => {
    const { t } = useTranslation();
    const {} = useCatalogRecords();

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
            <Button
                className="h-2rem"
                outlined
                rounded
                icon="pi pi-check"
                label={t("catalog-records.action-approve-difference")}
            />
        </div>
    );
};

export default CatalogRecordsDifference;
