import { Button } from "primereact/button";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import InsertDocuments from "../insert-documents/InsertDocuments";
import { Dialog } from "primereact/dialog";

interface DocumentsInsertMenuProps {}

const DocumentsInsertMenu: React.FC<DocumentsInsertMenuProps> = ({}) => {
    const { t } = useTranslation();
    const [isInsertDialogVisible, setIsInsertDialogVisible] = useState(false);

    return (
        <div>
            <Button
                label={t("insert_document")}
                icon="pi pi-plus"
                outlined
                onClick={() => setIsInsertDialogVisible(true)}
            />
            <Dialog
                visible={isInsertDialogVisible}
                onHide={() => setIsInsertDialogVisible(false)}
            >
                <InsertDocuments />
            </Dialog>
        </div>
    );
};

export default DocumentsInsertMenu;
