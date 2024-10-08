import React from "react";
import { TabPanel, TabView } from "primereact/tabview";
import {
    CatalogRecord,
    Frequency,
    MarcFieldDifference,
} from "../../adapters/ApiCatalogRecords";
import { formatDatetime } from "../../data/factories/DateFactory";
import { useTranslation } from "react-i18next";
import CatalogRecordsDifference from "./CatalogRecordDifference";
import LabeledComponentsBox from "../../components/layouts/LabeledComponentsBox";
import MaterialTypeTag from "../../components/tags/MaterialTypeTag";
import ExternalLinkButton from "../../components/buttons/ExternalLinkButton";
import StringListDisplay from "../../components/layouts/StringListDisplay";

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
    { attribute: "id", label: "catalog-records.mzk-sysno" },
    { attribute: "cnb", label: "catalog-records.cnb" },
    { attribute: "language", label: "catalog-records.language" },
    { attribute: "signature", label: "catalog-records.signature" },
    { attribute: "isxn", label: "catalog-records.isxn" },
    {
        attribute: "barcodes",
        label: "catalog-records.barcodes",
        transform: (bs) => <StringListDisplay stringList={bs} maxItems={10} />,
    },
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
        label: "catalog-records.added-at",
        transform: formatDatetime,
    },
    {
        attribute: "updated_at",
        label: "catalog-records.updated-at",
        transform: formatDatetime,
    },
    {
        attribute: "material_type",
        label: "catalog-records.material-type",
        transform: (mt) => <MaterialTypeTag materialType={mt} />,
    },
    { attribute: "title", label: "catalog-records.title" },
    { attribute: "size", label: "catalog-records.size" },
    {
        attribute: "location_uri",
        label: "catalog-records.location-uri",
        transform: (lu) => <ExternalLinkButton label={lu} url={lu} />,
    },
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
    {
        attribute: "frequencies",
        label: "catalog-records.frequencies",
        transform: (fs: Frequency[]) =>
            fs
                .map((f) =>
                    f.date
                        ? `"${f.date}": "${f.frequency}"`
                        : `"${f.frequency}"`
                )
                .join(", "),
    },
];

const CatalogRecordData: React.FC<CatalogRecordViewProps> = ({
    catalogRecord,
}) => {
    const { t } = useTranslation();

    return (
        <LabeledComponentsBox
            labels={catalogRecordFields.map((field) => t(field.label))}
            components={catalogRecordFields.map((field) => {
                const value =
                    field.transform && catalogRecord[field.attribute]
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
                t(`catalog-records.difference.${difference.difference_type}`)
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
