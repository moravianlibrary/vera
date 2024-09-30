import React from "react";
import { TabPanel, TabView } from "primereact/tabview";
import {
    CatalogRecord,
    MarcFieldDifference,
} from "../../adapters/ApiCatalogRecords";
import { formatDatetime } from "../../data/factories/DateFactory";
import { useTranslation } from "react-i18next";
import CatalogRecordsDifference from "./CatalogRecordDifference";
import LabeledComponentsBox from "../../components/layouts/LabeledComponentsBox";

interface CatalogRecordViewProps {
    catalogRecord: CatalogRecord;
}

interface CatalogRecordField {
    attribute: keyof CatalogRecord;
    label: string;
    transform?: (value: any) => any;
    translate?: boolean;
}

const catalogRecordFields: CatalogRecordField[] = [
    { attribute: "sysno", label: "catalog-records.mzk-sysno" },
    { attribute: "cnb", label: "catalog-records.cnb" },
    { attribute: "language", label: "catalog-records.language" },
    { attribute: "signature", label: "catalog-records.signature" },
    { attribute: "isxn", label: "catalog-records.isxn" },
    { attribute: "skc_sysno", label: "catalog-records.skc-sysno" },
    {
        attribute: "has_valid_main_record",
        label: "catalog-records.has-valid-main-record",
        transform: (b) => (b ? "common.yes" : "common.no"),
        translate: true,
    },
    { attribute: "cnb_sysno", label: "catalog-records.cnb-sysno" },
    {
        attribute: "has_valid_cnb",
        label: "catalog-records.has-valid-cnb",
        transform: (b) => (b ? "common.yes" : "common.no"),
        translate: true,
    },
    {
        attribute: "added_at",
        label: "catalog-records.added_at",
        transform: formatDatetime,
    },
    {
        attribute: "updated_at",
        label: "catalog-records.updated_at",
        transform: formatDatetime,
    },
    { attribute: "material_type", label: "catalog-records.material-type" },
    { attribute: "title", label: "catalog-records.title" },
    { attribute: "size", label: "catalog-records.size" },
    { attribute: "location_uri", label: "catalog-records.location-uri" },
    { attribute: "publisher", label: "catalog-records.publisher" },
    {
        attribute: "publishing_place",
        label: "catalog-records.publishing-place",
    },
    { attribute: "publishing_year", label: "catalog-records.publishing-year" },
    {
        attribute: "languages",
        label: "catalog-records.languages",
        transform: (l) => l.join(", "),
    },
    { attribute: "frequencies", label: "catalog-records.frequencies" },
];

const CatalogRecordData: React.FC<CatalogRecordViewProps> = ({
    catalogRecord,
}) => {
    const { t } = useTranslation();

    return (
        <LabeledComponentsBox
            labels={catalogRecordFields.map((field) => t(field.label))}
            components={catalogRecordFields.map((field) => {
                const value = field.transform
                    ? field.transform(catalogRecord[field.attribute])
                    : catalogRecord[field.attribute];
                return field.translate ? t(value) : value;
            })}
        />
    );
};

const CatalogRecordDifferences = (differences: MarcFieldDifference[]) => {
    const { t } = useTranslation();

    const sortDifferences = (
        a: MarcFieldDifference,
        b: MarcFieldDifference
    ) => {
        return a.tag.localeCompare(b.tag);
    };

    const sorted = differences.sort(sortDifferences);

    return (
        <LabeledComponentsBox
            labels={sorted.map((difference) =>
                t(
                    `catalog-records.table.difference.${difference.difference_type}`
                )
            )}
            components={sorted.map((difference) => (
                <CatalogRecordsDifference
                    key={difference.toString()}
                    difference={difference}
                />
            ))}
        />
    );
};

const CatalogRecordDetails: React.FC<CatalogRecordViewProps> = ({
    catalogRecord,
}) => {
    const { t } = useTranslation();

    return (
        <TabView>
            <TabPanel
                className="catalog-records-details-tabpanel"
                header={t("catalog-records.details.data")}
            >
                <CatalogRecordData catalogRecord={catalogRecord} />
            </TabPanel>
            {catalogRecord.skc_difference &&
                catalogRecord.skc_difference.length > 0 && (
                    <TabPanel
                        className="catalog-records-details-tabpanel"
                        header={t("catalog-records.details.skc-difference")}
                    >
                        {CatalogRecordDifferences(catalogRecord.skc_difference)}
                    </TabPanel>
                )}
            {catalogRecord.cnb_difference &&
                catalogRecord.cnb_difference.length > 0 && (
                    <TabPanel
                        className="catalog-records-details-tabpanel"
                        header={t("catalog-records.details.cnb-difference")}
                    >
                        {CatalogRecordDifferences(catalogRecord.cnb_difference)}
                    </TabPanel>
                )}
        </TabView>
    );
};

export default CatalogRecordDetails;
