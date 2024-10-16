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
    label: string;
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
    { attribute: "id", label: "ID" },
    {
        attribute: "sysno",
        label: "System number",
        createLink: createMzkAlephLink,
    },
    { attribute: "barcode", label: "Barcode" },
    { attribute: "volume", label: "Volume" },
    { attribute: "volume_number", label: "Volume (number)" },
    { attribute: "volume_year", label: "Volume year" },
    { attribute: "volume_year_number", label: "Volume year (number)" },
    { attribute: "bundle", label: "Bundle" },
    { attribute: "bundle_number", label: "Bundle (number)" },
    { attribute: "cnb", label: "CNB" },
    { attribute: "language", label: "Language" },
    { attribute: "signature", label: "Signature" },
    { attribute: "isxn", label: "ISXN" },
    {
        attribute: "added_at",
        label: "Added at",
        transform: (value) => format(new Date(value), "dd.MM.yyyy HH:mm:ss"),
    },
    { attribute: "added_by", label: "Added by" },
    {
        attribute: "category_path",
        label: "Category path",
        transform: (value) => value.map((x) => x.category_name).join(" > "),
    },
    {
        attribute: "skc_sysno",
        label: "SKC system number",
        createLink: createSkcLink,
    },
    { attribute: "has_valid_main_record", label: "Has valid main record" },
    {
        attribute: "cnb_sysno",
        label: "CNB system number",
        createLink: createCnbLink,
    },
    { attribute: "has_valid_cnb", label: "Has valid CNB" },
    {
        attribute: "digitization_registry_id",
        label: "Digitization registry ID",
    },
    {
        attribute: "digitization_state",
        label: "Digitization state",
    },
    { attribute: "page_count", label: "Page count" },
    { attribute: "page_count_catalog", label: "Page count catalog" },
    {
        attribute: "page_count_manual",
        label: "Page count manual",
        editable: true,
    },
    { attribute: "page_count_predicted", label: "Page count predicted" },
    // { attribute: "dedicated_scanner", label: "Dedicated scanner" },
    {
        attribute: "extraction_priority",
        label: "Extraction priority",
        editor: ExtractionPriorityEditor,
    },
    { attribute: "is_extractable", label: "Is extractable" },
    { attribute: "digitization_list_id", label: "Digitization list ID" },
    { attribute: "material_type", label: "Material type" },
    { attribute: "issuance_type", label: "Issuance type" },
    { attribute: "title", label: "Title" },
    { attribute: "size", label: "Size" },
    { attribute: "location_uri", label: "Location URI" },
    { attribute: "publisher", label: "Publisher" },
    { attribute: "publishing_place", label: "Publishing place" },
    { attribute: "publishing_year", label: "Publishing year" },
    { attribute: "languages", label: "Languages" },
    {
        attribute: "frequencies",
        label: "Frequencies",
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
    const { t } = useTranslation();

    const [editMode, setEditMode] = useState(false);

    if (!document[field.attribute]) return null;

    return (
        <div
            key={field.label}
            className="flex justify-content-between align-items-center gap-5 m-0"
        >
            <label>{t(field.label)}:</label>
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
