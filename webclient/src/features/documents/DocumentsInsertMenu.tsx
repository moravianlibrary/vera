import { Button } from "primereact/button";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import InsertDocuments from "../insert-documents/InsertDocuments";
import { Dialog } from "primereact/dialog";
import { InsertDocumentsProvider } from "../../contexts/insert-documents/InsertDocumentsContext";

interface DocumentsInsertMenuProps {}

const DocumentsInsertMenu: React.FC<DocumentsInsertMenuProps> = ({}) => {
    const { t } = useTranslation("documents");
    const [isInsertDialogVisible, setIsInsertDialogVisible] = useState(false);

    return (
        <div>
            <Button
                label={t("add-documents")}
                icon="pi pi-plus"
                outlined
                onClick={() => setIsInsertDialogVisible(true)}
            />
            <Dialog
                visible={isInsertDialogVisible}
                onHide={() => setIsInsertDialogVisible(false)}
            >
                <InsertDocumentsProvider>
                    <InsertDocuments
                        onClose={() => setIsInsertDialogVisible(false)}
                    />
                </InsertDocumentsProvider>
            </Dialog>
        </div>
    );
};

export default DocumentsInsertMenu;
