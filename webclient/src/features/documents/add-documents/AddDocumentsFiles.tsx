import { Button } from "primereact/button";
import { FileUpload, FileUploadHandlerEvent } from "primereact/fileupload";
import { Tag } from "primereact/tag";
import { useTranslation } from "react-i18next";
import { useNotification } from "../../../contexts/NotificationContext";
import { parseTextFileUpload } from "./FileUploadHandler";
import { useAddDocuments } from "../../../contexts/AddDocumentsContext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import AssignableCategoryPicker from "../../../components/selects/AssignableCategoryPicker";
import IdentifierTypeSelect from "../../../components/selects/IdentifierTypeSelect";
import { IdentifierWithAttributes } from "../../../adapters/ApiDocuments";

interface AddDocumentsFilesProps {
    attributes: IdentifierWithAttributes[];
    callback: (attributes: IdentifierWithAttributes[]) => void;
    cancel: () => void;
    submit: () => void;
}

const AddDocumentsFiles: React.FC<AddDocumentsFilesProps> = ({
    attributes,
    callback,
    cancel,
    submit,
}) => {
    const { t } = useTranslation("documents");
    const { showFailure } = useNotification();
    const { settings } = useAddDocuments();

    const itemTemplate = (file, props) => {
        return (
            <div className="flex align-items-center flex-wrap">
                <div
                    className="flex align-items-center"
                    style={{ width: "40%" }}
                >
                    <span className="flex flex-column text-left ml-3">
                        {file.name}
                        <small>{new Date().toLocaleDateString()}</small>
                    </span>
                </div>
                <Tag
                    value={props.formatSize}
                    severity="info"
                    className="px-3 py-2"
                />
                <Button
                    icon="pi pi-times"
                    className="p-button-text p-button-rounded p-button-danger ml-auto"
                    onClick={props.onRemove}
                />
            </div>
        );
    };

    const handleFileUpload = (e: FileUploadHandlerEvent) => {
        e.files.forEach((file) => {
            if (file.type === "text/plain") {
                parseTextFileUpload(
                    file,
                    settings.identifierType,
                    settings.categoryId,
                    settings.extractionPriority
                ).then((attributes) => callback(attributes));
                // } else if (
                //     file.type ===
                //     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                // ) {
                //     parseExcelFileUpload(file);
            } else {
                showFailure(t("File type not supported"));
            }
        });
    };

    if (attributes.length === 0) {
        return (
            <div>
                <FileUpload
                    mode="advanced"
                    customUpload={true}
                    uploadHandler={handleFileUpload}
                    // multiple
                    maxFileSize={2000000}
                    // accept="text/plain"
                    // chooseLabel={`${t("add.values.select-file")} (.txt, .xlsx)`}
                    chooseLabel={`${t("add.values.select-file")} (.txt)`}
                    uploadLabel={t("add.values.upload-file")}
                    cancelLabel={t("cancel", { ns: "app" })}
                    itemTemplate={itemTemplate}
                />
            </div>
        );
    }

    const changeAttribute = (attribute, value, options) => {
        callback(
            attributes.map((v, i) =>
                i === options.rowIndex
                    ? {
                          ...v,
                          [attribute]: value,
                      }
                    : v
            )
        );
    };

    return (
        <DataTable
            value={attributes}
            scrollable
            // scrollHeight="flex"
            scrollHeight="calc(100vh - 610px)"
            showHeaders={false}
            footer={
                <div className="flex gap-1 justify-content-between">
                    <Button
                        className="flex-grow-1"
                        severity="danger"
                        label={t("cancel", { ns: "app" })}
                        onClick={cancel}
                    />
                    <Button
                        className="flex-grow-1"
                        severity="success"
                        label={t("submit", { ns: "app" })}
                        onClick={submit}
                    />
                </div>
            }
        >
            <Column field="value" header={t("add.values.value")} />
            <Column
                field="identifier"
                header={t("properties.identifier")}
                body={(value, options) => (
                    <IdentifierTypeSelect
                        value={value.identifier_type}
                        callback={(v) =>
                            changeAttribute("identifier_type", v, options)
                        }
                    />
                )}
            />
            <Column
                field="category_id"
                header={t("properties.category")}
                body={(value, options) => (
                    <AssignableCategoryPicker
                        category_id={value.category_id}
                        callback={(v) =>
                            changeAttribute("category_id", v, options)
                        }
                        showClear={false}
                    />
                )}
            />
        </DataTable>
    );
};

export default AddDocumentsFiles;
