import { Button } from "primereact/button";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import ActionAccessComponent from "../../components/access/ActionAccessComponent";
import { ActionType } from "../../types/ActionType";
import AddDocumentsSteps from "./add-documents/AddDocumentsSteps";
import AddDocumentsProgress from "./add-documents/AddDocumentsProgress";
import { useAddDocuments } from "../../contexts/AddDocumentsContext";

interface AddDocumentsMenuProps {}

const AddDocumentsMenu: React.FC<AddDocumentsMenuProps> = ({}) => {
    const { t } = useTranslation("documents");
    const { numFoundAll } = useAddDocuments();

    const [visible, setVisible] = useState(false);

    return (
        <ActionAccessComponent action={ActionType.InsertDatatable}>
            <div className="flex flex-column">
                <div className="p-inputgroup">
                    <Button
                        label={t("add-documents")}
                        icon="pi pi-plus"
                        outlined
                        onClick={() => setVisible(true)}
                    />
                </div>
                <AddDocumentsProgress column />
                <Dialog
                    visible={visible}
                    onHide={() => setVisible(false)}
                    resizable={false}
                >
                    <AddDocumentsSteps
                        onHide={() => setVisible(false)}
                        initStep={numFoundAll === 0 ? 0 : 2}
                    />
                </Dialog>
            </div>
        </ActionAccessComponent>
    );
};

export default AddDocumentsMenu;
