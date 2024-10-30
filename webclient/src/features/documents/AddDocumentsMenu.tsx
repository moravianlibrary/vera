import { Button } from "primereact/button";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import ActionAccessComponent from "../../components/access/ActionAccessComponent";
import { ActionType } from "../../types/ActionType";
import AddDocumentsResults from "./add-documents/AddDocumentsResults";
import AddDocumentsSteps from "./add-documents/AddDocumentsSteps";
import AddDocumentsProgress from "./add-documents/AddDocumentsProgress";
import { useAddDocuments } from "../../contexts/AddDocumentsContext";

interface AddDocumentsMenuProps {}

const AddDocumentsMenu: React.FC<AddDocumentsMenuProps> = ({}) => {
    const { t } = useTranslation("documents");
    const { numFound } = useAddDocuments();

    const [addDocumentsVisible, setAddDocumentsVisible] = useState(false);
    const [responsesVisible, setResponseVisible] = useState(false);

    return (
        <ActionAccessComponent action={ActionType.InsertDatatable}>
            <div className="flex flex-column">
                <div className="p-inputgroup">
                    <Button
                        label={t("add-documents")}
                        icon="pi pi-plus"
                        outlined
                        onClick={() => setAddDocumentsVisible(true)}
                    />
                    {numFound > 0 && (
                        <Button
                            outlined
                            label={t("actions.show-responses-summary")}
                            onClick={() => setResponseVisible(true)}
                        />
                    )}
                </div>
                <AddDocumentsProgress column />
                <Dialog
                    visible={addDocumentsVisible}
                    onHide={() => setAddDocumentsVisible(false)}
                >
                    <AddDocumentsSteps />
                </Dialog>
                <Dialog
                    visible={responsesVisible}
                    onHide={() => setResponseVisible(false)}
                    className="my-dialog"
                >
                    <AddDocumentsResults />
                </Dialog>
            </div>
        </ActionAccessComponent>
    );
};

export default AddDocumentsMenu;
