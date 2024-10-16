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
    transform?: (value: any) => any;
    translate?: boolean;
}

const catalogRecordFields: CatalogRecordField[] = [
    { attribute: "id" },
    { attribute: "cnb" },
    { attribute: "language" },
    { attribute: "signature" },
    { attribute: "isxn" },
    {
        attribute: "barcodes",
        transform: (bs) => <StringListDisplay stringList={bs} maxItems={10} />,
    },
    { attribute: "skc_sysno" },
    {
        attribute: "has_valid_main_record",
        transform: (b) => (b ? "common.yes" : "common.no"),
        translate: true,
    },
    { attribute: "cnb_sysno" },
    {
        attribute: "has_valid_cnb",
        transform: (b) => (b ? "common.yes" : "common.no"),
        translate: true,
    },
    {
        attribute: "added_at",
        transform: formatDatetime,
    },
    {
        attribute: "updated_at",
        transform: formatDatetime,
    },
    {
        attribute: "material_type",
        transform: (mt) => <MaterialTypeTag materialType={mt} />,
    },
    { attribute: "title" },
    { attribute: "size" },
    {
        attribute: "location_uri",
        transform: (lu) => <ExternalLinkButton label={lu} url={lu} />,
    },
    { attribute: "publisher" },
    {
        attribute: "publishing_place",
    },
    { attribute: "publishing_year" },
    {
        attribute: "languages",
        transform: (l) => l.join(", "),
    },
    {
        attribute: "frequencies",
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
    const { t } = useTranslation("catalog-records");

    return (
        <LabeledComponentsBox
            labels={catalogRecordFields.map((field) =>
                t(`properties.${field.attribute}`)
            )}
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
    const { t } = useTranslation("types");

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
                t(`record-difference.${difference.difference_type}`)
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
    const { t } = useTranslation("catalog-records");

    return (
        <TabView>
            <TabPanel
                className="catalog-records-details-tabpanel"
                header={t("table.details")}
            >
                <CatalogRecordData catalogRecord={catalogRecord} />
            </TabPanel>
            {catalogRecord.skc_difference &&
                catalogRecord.skc_difference.length > 0 && (
                    <TabPanel
                        className="catalog-records-details-tabpanel"
                        header={t("table.skc-difference")}
                    >
                        {CatalogRecordDifferences(catalogRecord.skc_difference)}
                    </TabPanel>
                )}
            {catalogRecord.cnb_difference &&
                catalogRecord.cnb_difference.length > 0 && (
                    <TabPanel
                        className="catalog-records-details-tabpanel"
                        header={t("table.cnb-difference")}
                    >
                        {CatalogRecordDifferences(catalogRecord.cnb_difference)}
                    </TabPanel>
                )}
        </TabView>
    );
};

export default CatalogRecordDetails;
