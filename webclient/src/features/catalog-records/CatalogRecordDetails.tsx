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
import TagsView from "../../components/views/TagsView";
import SkcRecordFlagTag from "../../components/tags/SkcRecordFlagTag";
import CnbRecordFlagTag from "../../components/tags/CnbRecordFlagTag";

interface CatalogRecordViewProps {
    catalogRecord: CatalogRecord;
}

interface CatalogRecordField {
    attribute: keyof CatalogRecord;
    transform?: (value: any) => any;
    translate?: boolean;
    translateNs?: string;
}

const catalogRecordFields: CatalogRecordField[] = [
    {
        attribute: "id",
        transform: (value) => <ExternalLinkButton.MzkCatalog value={value} />,
    },
    { attribute: "cnb" },
    { attribute: "language" },
    { attribute: "signature" },
    { attribute: "isxn" },
    {
        attribute: "barcodes",
        transform: (bs) => <StringListDisplay stringList={bs} maxItems={10} />,
    },
    {
        attribute: "skc_sysno",
        transform: (value) => <ExternalLinkButton.SckCatalog value={value} />,
    },
    {
        attribute: "skc_record_flags",
        transform: (flags) => (
            <TagsView
                values={flags}
                onDisplayValue={(f, i) => (
                    <SkcRecordFlagTag key={i} value={f} />
                )}
            />
        ),
    },
    {
        attribute: "cnb_sysno",
        transform: (value) => <ExternalLinkButton.CnbCatalog value={value} />,
    },
    {
        attribute: "cnb_record_flags",
        transform: (flags) => (
            <TagsView
                values={flags}
                onDisplayValue={(f, i) => (
                    <CnbRecordFlagTag key={i} value={f} />
                )}
            />
        ),
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
            components={catalogRecordFields.map((field, index) => {
                const value =
                    field.transform &&
                    catalogRecord[field.attribute] !== undefined &&
                    catalogRecord[field.attribute] !== null
                        ? field.transform(catalogRecord[field.attribute])
                        : catalogRecord[field.attribute];
                return field.translate && typeof value === "string"
                    ? t(value, { ns: field.translateNs || "catalog-records" })
                    : value;
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
                t(`marc-difference.${difference.difference_type}`)
            )}
            components={sorted.map((difference) => (
                <CatalogRecordsDifference
                    key={difference.toString()}
                    difference={difference}
                />
            ))}
            center
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
                header={t("details.data")}
            >
                <CatalogRecordData catalogRecord={catalogRecord} />
            </TabPanel>
            {catalogRecord.skc_difference &&
                catalogRecord.skc_difference.length > 0 && (
                    <TabPanel
                        className="catalog-records-details-tabpanel"
                        header={t("details.skc-difference")}
                    >
                        {CatalogRecordDifferences(catalogRecord.skc_difference)}
                    </TabPanel>
                )}
            {catalogRecord.cnb_difference &&
                catalogRecord.cnb_difference.length > 0 && (
                    <TabPanel
                        className="catalog-records-details-tabpanel"
                        header={t("details.cnb-difference")}
                    >
                        {CatalogRecordDifferences(catalogRecord.cnb_difference)}
                    </TabPanel>
                )}
        </TabView>
    );
};

export default CatalogRecordDetails;
