import { DataTable } from "primereact/datatable";
import { FileUpload } from "primereact/fileupload";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import React from "react";
import { Column } from "primereact/column";
import { useTranslation } from "react-i18next";

const InsertDocumentsFiles: React.FC = () => {
    const { t } = useTranslation();
    const { fileUploadValues, handleFileUpload } = useInsertDocuments();

    if (fileUploadValues.length === 0) {
        return (
            <div>
                <FileUpload
                    mode="advanced"
                    customUpload={true}
                    uploadHandler={handleFileUpload}
                    multiple
                    maxFileSize={2000000}
                />
            </div>
        );
    }

    console.log(fileUploadValues);

    return (
        <DataTable value={fileUploadValues}>
            <Column field="filename" header={t("Filename")} />
            <Column field="value" header={t("Value")} />
            <Column
                field="identifier"
                header={t("Identifier")}
                body={(v) => v.identifier.label}
            />
            <Column field="category_id" header={t("Category")} />
            <Column></Column>
        </DataTable>
    );
};

export default InsertDocumentsFiles;
