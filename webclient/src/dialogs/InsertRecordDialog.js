import React, { useState, useEffect } from "react";
import { InputText } from "primereact/inputtext";
import { Dialog } from "primereact/dialog";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { useTranslation } from "react-i18next";
import { dataService } from "../services/Data";
import { DataView } from "primereact/dataview";
import IssueTemplate from "../components/IssueTemplate";

const InsertRecordDialog = (props) => {
    const { t } = useTranslation();
    const { header } = props;
    const [visible, setVisible] = useState(false);

    const [identifier, setIdentifier] = useState("barcode");

    const [categories, setCategories] = useState([]);
    const [category, setCategory] = useState("");

    const [value, setValue] = useState("");
    const [chainInsert, setChainInsert] = useState(() => {
        const storedState = localStorage.getItem('chainInsert');
        return storedState ? JSON.parse(storedState) : true;
    });

    const [record, setRecord] = useState(null);
    const [issues, setIssues] = useState([]);

    const hideDialog = () => {
        setValue("");
        setRecord(null);
        setIssues([]);

        if (!chainInsert) {
            if (props.onHide) {
                props.onHide();
            }
            setVisible(false);
        }
    };

    const handleInput = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    }

    const handleValueChange = (e) => {
        setValue(e.target.value);
    }; 

    const handleConfirm = async () => {
        const precreateRecord = await dataService.precreateRecord("sysno", value);
        setRecord(precreateRecord);
        if (precreateRecord.issues) {
            setIssues(precreateRecord.issues);
        } else if (precreateRecord.record.material_type === "continuing_resource") {

        } else {
            hideDialog();
        }
    };

    const handleIssueClick = (issue) => {
        dataService.createRecord(record.toCreateRecord(categories.find(c => c.name == category).id, issue));
    }

    useEffect(() => {
        if (category && typeof category === 'string' && category.trim() !== "") {
            localStorage.setItem('selectedCategory', JSON.stringify(category));
        }
    }, [category]);

    useEffect(() => {
        localStorage.setItem('chainInsert', JSON.stringify(chainInsert));
    }, [chainInsert]);

    useEffect(() => {
        setCategories(props.categories);
        const storedState = localStorage.getItem('selectedCategory');
        if (storedState) {
            const category = props.categories.find(value => value.name === JSON.parse(storedState));
            if (category) {
                setCategory(category.name);
            }
        }
    }, [props.categories]);

    useEffect(() => {
        if (props.visible) {
            setVisible(props.visible);
        }
    }, [props.visible]);

    return (
        <Dialog
            header={header}
            visible={visible}
            autoFocus
            onHide={hideDialog}
            handleConfirm={handleConfirm}
        >
            {(!issues || issues.length === 0) &&
            <div className="flex gap-3">
                <Card 
                    title={t('category_card_title')}
                >
                    <div className="flex flex-column gap-2">
                        <div className="flex align-items-center gap-4">
                            <label htmlFor="select_category_dropdown" className="ml-2">{t('insert_into_category')}</label>
                            <Dropdown
                                inputId="select_category_dropdown"
                                value={category}
                                options={categories.map(category => category.name)}
                                onChange={e => setCategory(e.value)}
                            />
                        </div>
                        <InputText
                            type="text" 
                            onChange={handleValueChange}
                            value={value}
                            autoFocus
                            onKeyDown={handleInput}
                        />
                        <div className="flex align-items-center">
                            <Checkbox 
                                inputId="chain_insert"
                                onChange={e => setChainInsert(e.checked)}
                                checked={chainInsert} />
                            <label htmlFor="chain_insert" className="ml-2">{t('chain_insert_checkbox')}</label>
                        </div>
                    </div>
                </Card>

                <div className="mt-auto ml-auto">
                    <Button className="p-button-rounded p-button-text p-button-success" icon="pi pi-check" onClick={handleConfirm} />
                </div>
            </div>}

            {(issues && issues.length > 0) && 
            <div className="flex flex-column gap-2 justify-end">
                <Card>
                    <DataView value={issues} 
                        itemTemplate={(issue) => <IssueTemplate issue={issue} onClick={handleIssueClick} />}
                    />
                </Card>

            </div>}
        </Dialog>
    );
}

export default InsertRecordDialog;