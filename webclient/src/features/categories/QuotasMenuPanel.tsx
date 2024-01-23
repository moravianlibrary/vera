import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Divider } from "primereact/divider";
import { Dropdown } from 'primereact/dropdown';
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Menu } from "primereact/menu";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const QuotasMenuPanel = (props) => {
    const { t } = useTranslation();
    const [selectedQuota, setSelectedQuota] = useState(null);
    const [quotas, setQuotas] = useState([]);

    const [editMode, setEditMode] = useState(false);
    const [insertMode, setInsertMode] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [pagesCount, setPagesCount] = useState(0);

    const floatingPanelStyle: React.CSSProperties = {
        position: 'fixed',
        top: '70px',
        right: '20px',
        zIndex: '1000',
        boxShadow: '0px 0px 10px 0px rgba(0,0,0,0.35)',
        margin: '0px',
        padding: '0px',
    };

    const handleSelectQuota = (e) => {
        if (props.onSelect) {
            props.onSelect(e.target.value);
        }
    };

    const handleEditQuota = (quota) => {
        if (quota) {
            setName(quota.name);
            setDescription(quota.description);
            setPagesCount(quota.pages_count);
        }
        setEditMode(true);
    };

    const handleInsertQuota = () => {
        // handleEditQuota(new Quota());
        setInsertMode(true);
    };

    const handleCancelEdit = () => {
        setEditMode(false);
        setInsertMode(false);
    }

    const handleUpdateQuota = () => {
        if (props.onUpdate) {
            // const quota = new Quota();
            // if (!insertMode) {
            //     quota.id = selectedQuota.id;
            // }
            // quota.name = name;
            // quota.description = description;
            // quota.pages_count = pagesCount;
            // props.onUpdate(quota);
        }
        setEditMode(false);
        setInsertMode(false);
    };

    const handleDeleteQuota = () => {
        if (props.onDelete) {
            props.onDelete(selectedQuota);
        }
    };

    const handleSetActive = () => {
        if (props.onSetActive) {
            props.onSetActive(selectedQuota);
        }
    };

    useEffect(() => {
        setSelectedQuota(props.selectedQuota);
    }, [props.selectedQuota]);

    useEffect(() => {
        setQuotas(props.quotas);
    }, [props.quotas]);

    if (selectedQuota && editMode) {
        return (
            <div className="flex flex-column bg-white p-2 gap-2" style={floatingPanelStyle}>
                <InputText
                    value={name}
                    onChange={(e) => setName(e.target.value)} 
                />
                <InputTextarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)} 
                />
                <div className="flex align-items-center gap-2">
                    <span className="font-bold">{t('pages_count')}:</span>
                    <InputNumber className="w-10rem"
                        value={pagesCount}
                        onValueChange={(e) => setPagesCount(e.target.value)} 
                    />
                </div>
                <div className="flex justify-content-end gap-2">
                    <Button outlined severity="success" onClick={handleUpdateQuota}>
                        <i className="pi pi-check" />
                    </Button>
                    <Button outlined severity="danger" onClick={handleCancelEdit}>
                        <i className="pi pi-times" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-column bg-white p-2 gap-2" style={floatingPanelStyle}>
            <span className="font-bold p-2">{t('select_quota')}:</span>
            <div className="flex">
                <Dropdown
                    options={quotas}
                    optionLabel="name"
                    value={selectedQuota}
                    onChange={handleSelectQuota}
                />
                <Button
                    className="pi pi-plus p-2"
                    text
                    onClick={handleInsertQuota}
                />
            </div>
            {selectedQuota && selectedQuota.description &&
            <span>{selectedQuota.description}</span>}
            {selectedQuota &&
            <span className="font-bold">{t('pages_count')}: {selectedQuota.pages_count}</span>}
            {selectedQuota && selectedQuota.active &&
            <span className="font-bold text-yellow-800">{t('active_quota')}</span>}
            {selectedQuota &&
            <div className="flex justify-content-end gap-2">
                {!selectedQuota.active &&
                <Button
                    className="text-yellow-800"
                    outlined
                    tooltip={t('set_active_quota')}
                    onClick={handleSetActive}
                >
                    <i className="pi pi-star-fill" />
                </Button>}
                <Button outlined onClick={(e) => handleEditQuota(selectedQuota)}>
                    <i className="pi pi-pencil" />
                </Button>
                <Button outlined severity="danger" onClick={handleDeleteQuota}>
                    <i className="pi pi-trash" />
                </Button>
            </div>}
        </div>
    );
};

export default QuotasMenuPanel;
