import React from "react";
import { useTranslation } from "react-i18next";
import {
    Frequency,
    IndexDocument,
    UpdateAttributes,
} from "../../adapters/ApiDocuments";
import { useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import ExtractionPriorityEditor from "../../components/editors/ExtractionPriorityEditor";
import EditorProps from "../../components/editors/Editor";
import { useDocuments } from "../../contexts/DocumentsContext";
import { formatDatetime } from "../../data/factories/DateFactory";
import ExternalLinkButton from "../../components/buttons/ExternalLinkButton";
import DigitizationStateTag from "../../components/tags/DigitizationStateTag";
import MaterialTypeTag from "../../components/tags/MaterialTypeTag";
import IssuanceTypeTag from "../../components/tags/IssuanceTypeTag";
import { createCategoryPathLabel } from "../../data/factories/LabelsFactory";
import DocumentFlagTag from "../../components/tags/DocumentFlagTag";
import LabeledComponentsBox from "../../components/layouts/LabeledComponentsBox";
import ExtractionPriorityTag from "../../components/tags/ExtractionPriorityTag";
import { useNotification } from "../../contexts/NotificationContext";

interface DocumentDetailsFieldType {
    attribute: string;
    transform?: (value: any) => any;
    editor?: React.FC<EditorProps<any>>;
    copy?: boolean;
}

interface DocumentDetailsFieldProps {
    document: IndexDocument;
    field: DocumentDetailsFieldType;
}

const DocumentFields = [
    { attribute: "id", copy: true },
    {
        attribute: "sysno",
        transform: (value) => <ExternalLinkButton.MzkCatalog value={value} />,
        copy: true,
    },
    { attribute: "barcode", copy: true },
    { attribute: "volume", copy: true },
    { attribute: "volume_number", copy: true },
    { attribute: "volume_year", copy: true },
    { attribute: "volume_year_number", copy: true },
    { attribute: "bundle", copy: true },
    { attribute: "bundle_number", copy: true },
    { attribute: "cnb", copy: true },
    { attribute: "language", copy: true },
    { attribute: "signature", copy: true },
    { attribute: "isxn", copy: true },
    {
        attribute: "added_at",
        transform: formatDatetime,
    },
    { attribute: "added_by" },
    {
        attribute: "indexed_at",
        transform: formatDatetime,
    },
    {
        attribute: "category_path",
        transform: createCategoryPathLabel,
    },
    {
        attribute: "document_flags",
        transform: (value) => <DocumentFlagTag.List flags={value} column />,
    },
    {
        attribute: "skc_sysno",
        transform: (value) => <ExternalLinkButton.SckCatalog value={value} />,
        copy: true,
    },
    {
        attribute: "cnb_sysno",
        transform: (value) => <ExternalLinkButton.CnbCatalog value={value} />,
        copy: true,
    },
    {
        attribute: "digitization_registry_id",
        transform: (value) => (
            <ExternalLinkButton.DigitizationRegistry value={value} />
        ),
        copy: true,
    },
    {
        attribute: "digitization_state",
        transform: (value) => <DigitizationStateTag state={value} />,
    },
    { attribute: "page_count" },
    { attribute: "page_count_catalog" },
    {
        attribute: "page_count_manual",
        editable: true,
    },
    { attribute: "page_count_predicted" },
    // { attribute: "dedicated_scanner" },
    {
        attribute: "extraction_priority",
        transform: (value) => <ExtractionPriorityTag priority={value} />,
        editor: ExtractionPriorityEditor,
    },
    { attribute: "digitization_list_id" },
    {
        attribute: "material_type",
        transform: (value) => <MaterialTypeTag materialType={value} />,
    },
    {
        attribute: "issuance_type",
        transform: (value) => <IssuanceTypeTag issuanceType={value} />,
    },
    { attribute: "title", copy: true },
    { attribute: "size", copy: true },
    {
        attribute: "location_uri",
        transform: (value) => (
            <a href={value} target="_blank">
                {value}
            </a>
        ),
    },
    { attribute: "publisher", copy: true },
    { attribute: "publishing_place", copy: true },
    { attribute: "publishing_year", copy: true },
    { attribute: "languages", copy: true },
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
        copy: true,
    },
];

interface DocumentsDetailsProps {}

const DocumentsDetails: React.FC<DocumentsDetailsProps> = () => {
    const { expandedRows, onRowCollapse } = useDocuments();

    console.log(expandedRows);

    return (
        <div>
            {/* {expandedRows.map((document) => (
                <Dialog
                    id={`document-details-${document.id}`}
                    key={`document-details-${document.id}`}
                    style={{
                        maxWidth: "80%",
                        minWidth: "600px",
                    }}
                    visible={expandedRows
                        .map((d) => d.id)
                        .includes(document.id)}
                    onHide={() => onRowCollapse(document)}
                    modal={false}
                >
                    <DocumentDetails document={document} />
                </Dialog>
            ))} */}
        </div>
    );
};

interface DocumentDetailsProps {
    document: IndexDocument;
}

const DocumentDetails: React.FC<DocumentDetailsProps> = ({ document }) => {
    const { t } = useTranslation("documents");

    return (
        <LabeledComponentsBox
            labels={DocumentFields.map((field) =>
                t(`properties.${field.attribute}`)
            )}
            components={DocumentFields.map(
                (field, index) =>
                    field.attribute in document && (
                        <DocumentDetailsItem
                            key={index}
                            field={field}
                            document={document}
                        />
                    )
            )}
            ignoreNotProvided
        />
    );
};

const DocumentDetailsItem: React.FC<DocumentDetailsFieldProps> = ({
    document,
    field,
}) => {
    const { t } = useTranslation("documents");
    const { showInfo } = useNotification();
    const { updateDocumentAttribute } = useDocuments();

    const [editMode, setEditMode] = useState<boolean>(false);

    const copyToClipboard = (value: string) => {
        navigator.clipboard.writeText(value);
        showInfo(t("copied-to-clipboard"), value);
    };

    const onEditorCallback = (value: any) => {
        if (field.attribute === "category_path") {
            updateDocumentAttribute(document.id, "category_id", value);
        } else if (
            ["extraction_priority", "pages_count_manual"].includes(
                field.attribute
            )
        ) {
            updateDocumentAttribute(
                document.id,
                field.attribute as UpdateAttributes,
                value
            );
        } else {
            console.log(field.attribute);
        }
        setEditMode(false);
    };

    if (editMode) {
        return (
            <field.editor
                value={document[field.attribute]}
                editorCallback={onEditorCallback}
                cancelCallback={() => setEditMode(false)}
            />
        );
    }

    return (
        <div key={field.attribute} className="flex align-items-center gap-2">
            {field.transform ? (
                field.transform(document[field.attribute])
            ) : (
                <span>{document[field.attribute]}</span>
            )}
            {field.editor && (
                <Button
                    className="p-1 text-xs align-content-center text-yellow-500"
                    text
                    onClick={() => setEditMode(true)}
                >
                    <i className="pi pi-pencil" />
                </Button>
            )}
            {field.copy && (
                <Button
                    className="p-1 text-xs align-content-center text-cyan-500"
                    text
                    onClick={() =>
                        copyToClipboard(document[field.attribute] as string)
                    }
                >
                    <i className="pi pi-copy" />
                </Button>
            )}
        </div>
    );
};

export default DocumentsDetails;
