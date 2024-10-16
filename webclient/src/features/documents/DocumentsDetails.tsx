import React from "react";
import { useTranslation } from "react-i18next";
import { Frequency, IndexDocument } from "../../adapters/ApiDocuments";
import { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import LabeledComponent from "../../components/LabeledComponent";
import { useToast } from "../../contexts/ToastContext";
import { format } from "date-fns";
import ExtractionPriorityEditor from "../../components/editors/ExtractionPriorityEditor";
import EditorProps from "../../components/editors/Editor";
import { useDocuments } from "../../contexts/DocumentsContext";

interface DocumentDetailsDialogProps {
    document: IndexDocument;
}

interface DocumentDetailsFieldType {
    attribute: string;
    transform?: (value: any) => any;
    createLink?: (value: any) => string;
    editor?: React.FC<EditorProps<any>>;
}

interface DocumentDetailsFieldProps {
    document: IndexDocument;
    field: DocumentDetailsFieldType;
}

interface DocumentDetailsFieldValueProps {
    value: any;
    field: DocumentDetailsFieldType;
    toggleEditMode: () => void;
}

function createMzkAlephLink(sysno: string) {
    const sysnoSplit = sysno.split("-");
    return `https://aleph.mzk.cz:443/F?func=direct&doc_number=${sysnoSplit[1]}&local_base=${sysnoSplit[0]}&format=999`;
}

function createSkcLink(sysno: string) {
    return `https://aleph.nkp.cz/F/?func=direct&doc_number=${sysno}&local_base=SKC`;
}

function createCnbLink(sysno: string) {
    return `https://aleph.nkp.cz/F/?func=direct&doc_number=${sysno}&local_base=CNB`;
}

const DocumentFields = [
    { attribute: "id" },
    {
        attribute: "sysno",
        createLink: createMzkAlephLink,
    },
    { attribute: "barcode" },
    { attribute: "volume" },
    { attribute: "volume_number" },
    { attribute: "volume_year" },
    { attribute: "volume_year_number" },
    { attribute: "bundle" },
    { attribute: "bundle_number" },
    { attribute: "cnb" },
    { attribute: "language" },
    { attribute: "signature" },
    { attribute: "isxn" },
    {
        attribute: "added_at",
        transform: (value) => format(new Date(value), "dd.MM.yyyy HH:mm:ss"),
    },
    { attribute: "added_by" },
    {
        attribute: "category_path",
        transform: (value) => value.map((x) => x.category_name).join(" > "),
    },
    {
        attribute: "skc_sysno",
        createLink: createSkcLink,
    },
    { attribute: "has_valid_main_record" },
    {
        attribute: "cnb_sysno",
        createLink: createCnbLink,
    },
    { attribute: "has_valid_cnb" },
    {
        attribute: "digitization_registry_id",
    },
    {
        attribute: "digitization_state",
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
        editor: ExtractionPriorityEditor,
    },
    { attribute: "is_extractable" },
    { attribute: "digitization_list_id" },
    { attribute: "material_type" },
    { attribute: "issuance_type" },
    { attribute: "title" },
    { attribute: "size" },
    { attribute: "location_uri", createLink: (value) => value },
    { attribute: "publisher" },
    { attribute: "publishing_place" },
    { attribute: "publishing_year" },
    { attribute: "languages" },
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

interface DocumentsDetailsProps {}

const DocumentsDetails: React.FC<DocumentsDetailsProps> = () => {
    const { expandedRows, onRowCollapse } = useDocuments();

    return (
        <div>
            {expandedRows.map((document) => (
                <Dialog
                    id={`document-details-${document.id}`}
                    style={{
                        maxWidth: "600px",
                        marginLeft: "96px",
                        marginTop: "48px",
                    }}
                    visible={expandedRows
                        .map((d) => d.id)
                        .includes(document.id)}
                    onHide={() => onRowCollapse(document)}
                    modal={false}
                >
                    <div className="flex flex-column justify-content-between gap-1 m-0">
                        {DocumentFields.map((field) => (
                            <DocumentDetailsItem
                                key={field.attribute}
                                document={document}
                                field={field}
                            />
                        ))}
                    </div>
                </Dialog>
            ))}
        </div>
    );
};

const DocumentDetailsItem: React.FC<DocumentDetailsFieldProps> = ({
    document,
    field,
}) => {
    const { t } = useTranslation("documents");
    const [editMode, setEditMode] = useState(false);

    if (!document[field.attribute]) return null;

    return (
        <div
            key={field.attribute}
            className="flex justify-content-between align-items-center gap-5 m-0"
        >
            <label>{t(`properties.${field.attribute}`)}:</label>
            {!editMode && (
                <DocumentDetailsFieldValue
                    value={
                        field.transform
                            ? field.transform(document[field.attribute])
                            : document[field.attribute]
                    }
                    field={field}
                    toggleEditMode={() => setEditMode(!editMode)}
                />
            )}
            {editMode && field.editor && (
                <div className="flex p-1">
                    <field.editor
                        value={document[field.attribute]}
                        editorCallback={(value) => {
                            document[field.attribute] = value;
                            setEditMode(!editMode);
                        }}
                        cancelCallback={() => setEditMode(!editMode)}
                    />
                </div>
            )}
        </div>
    );
};

const DocumentDetailsFieldValue: React.FC<DocumentDetailsFieldValueProps> = ({
    value,
    field,
    toggleEditMode,
}) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const copyToClipboard = (value: string) => {
        navigator.clipboard.writeText(value);
        showToast("info", t("Copied to clipboard"), "");
    };

    return (
        <div className="flex gap-1 align-items-center">
            <span className="p-0 max-w-23rem">{value}</span>
            {field.editor && (
                <Button
                    className="p-1 text-xs align-content-center text-yellow-500"
                    text
                    onClick={toggleEditMode}
                >
                    <i className="pi pi-pencil" />
                </Button>
            )}
            {field.createLink && (
                <Button
                    className="p-1 text-xs align-content-center text-blue-600"
                    severity="help"
                    text
                    onClick={() =>
                        window.open(field.createLink!(value), "_blank")
                    }
                >
                    <i className="pi pi-external-link" />
                </Button>
            )}
            <Button
                className="p-1 text-xs align-content-center text-cyan-500"
                text
                onClick={() => copyToClipboard(value as string)}
            >
                <i className="pi pi-copy" />
            </Button>
        </div>
    );
};

export default DocumentsDetails;
