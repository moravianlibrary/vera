import { InputText } from "primereact/inputtext";
import { TabView, TabPanel } from "primereact/tabview";
import { useTranslation } from "react-i18next";
import React, { useRef, useState } from "react";
import LabeledComponent from "../../../components/wrappers/LabeledComponent";
import { useAddDocuments } from "../../../contexts/AddDocumentsContext";
import AddDocumentsFiles from "./AddDocumentsFiles";
import { IdentifierWithAttributes } from "../../../adapters/ApiDocuments";
import { Button } from "primereact/button";

interface AddDocumentsValuesProps {}

const AddDocumentsValues: React.FC<AddDocumentsValuesProps> = () => {
    const { t } = useTranslation("documents");
    const { settings, addDocument, addDocuments } = useAddDocuments();

    const [value, setValue] = useState<string>("");
    const [attributes, setAttributes] = useState<IdentifierWithAttributes[]>(
        []
    );

    const tabViewRef = useRef<TabView>(undefined);
    const inputTextRef = useRef(null);

    const submitValue = () => {
        addDocument(value);
        setValue("");
        inputTextRef?.current?.focus();
    };

    const handleKeyPress = (event) => {
        if (event.key === "Enter") {
            submitValue();
        }
    };

    const submitAttributes = () => {
        addDocuments(attributes);
        setAttributes([]);
    };

    return (
        <div className="flex flex-column gap-1">
            <TabView ref={tabViewRef}>
                <TabPanel
                    className="flex flex-column gap-3"
                    header={t("add.values.text-input-header")}
                >
                    <LabeledComponent
                        label={t(`identifier-type.${settings.identifierType}`, {
                            ns: "types",
                        })}
                    >
                        <div className="p-inputgroup">
                            <InputText
                                ref={inputTextRef}
                                autoFocus
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onKeyDown={handleKeyPress}
                            />
                            <Button
                                className="flex-grow-1"
                                outlined
                                icon="pi pi-times"
                                severity="danger"
                                disabled={value === ""}
                                onClick={() => setValue("")}
                            />
                            <Button
                                className="flex-grow-1"
                                severity="success"
                                outlined
                                icon="pi pi-check"
                                disabled={value === ""}
                                onClick={submitValue}
                            />
                        </div>
                    </LabeledComponent>
                </TabPanel>
                <TabPanel header={t("add.values.file-input-header")}>
                    <AddDocumentsFiles
                        attributes={attributes}
                        callback={setAttributes}
                        cancel={() => setAttributes([])}
                        submit={submitAttributes}
                    />
                </TabPanel>
            </TabView>
        </div>
    );
};

export default AddDocumentsValues;
