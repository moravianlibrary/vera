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
import { useQuotas } from "../../contexts/categories/QuotasContext";
import { Quota } from "../../adapters/ApiCategories";
import { Tooltip } from "primereact/tooltip";
import { useToast } from "../../contexts/toast/ToastContext";
import { ActionAccessComponent } from "../../services/AccessService";
import { ActionType } from "../../types/ActionType";

const QuotasMenuPanel = (props) => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { quotas, selectedQuota, handleSelectQuota, handleCreateQuota,
        handleUpdateQuota, handleDeleteQuota, handleSetActiveQuota } = useQuotas();

    const [editMode, setEditMode] = useState(false);
    const [insertMode, setInsertMode] = useState(false);
    const [name, setName] = useState<string | undefined>(undefined);
    const [description, setDescription] = useState<string | undefined>(undefined);
    const [pagesCount, setPagesCount] = useState<number | undefined>(undefined);

    const floatingPanelStyle: React.CSSProperties = {
        position: 'fixed',
        top: '70px',
        right: '20px',
        zIndex: '1000',
        boxShadow: '0px 0px 10px 0px rgba(0,0,0,0.35)',
        margin: '0px',
        padding: '0px',
    };

    const handleEditQuota = () => {
        setName(selectedQuota!.name);
        setDescription(selectedQuota!.description ? selectedQuota!.description : undefined);
        setPagesCount(selectedQuota!.pages_count);
        setEditMode(true);
    };

    const handleInsertQuota = () => {
        setName("");
        setDescription(undefined);
        setPagesCount(undefined);
        setEditMode(true);
        setInsertMode(true);
    };

    const handleAcceptChanges = () => {
        if (!name) {
            showToast("warn", t("The quota name must be filled"), "");
            return;
        }
        if (!pagesCount) {
            showToast("warn", t("The quota pages count must be filled"), "");
            return;
        }
        if (insertMode) {
            handleCreateQuota({ name, description, pages_count: pagesCount });
        } else {
            handleUpdateQuota({ name, description, pages_count: pagesCount });
        }
    }

    const handleCancelEdit = () => {
        setEditMode(false);
        setInsertMode(false);
    }

    useEffect(() => {
        handleCancelEdit();
    }, [quotas]);

    const TooltipDropdownItem = ({ item }) => {
        return (
            <div>
                <Tooltip className="max-w-30rem" target=".quota-description" position="left" />
                <div className="quota-description" data-pr-tooltip={item.description} >
                    {item.name}
                </div>
            </div>
        );
    };

    if (!selectedQuota) {
        return (
            <div className="flex flex-column bg-white p-2 gap-2" style={floatingPanelStyle}>
                <span className="font-bold p-2">{t('select_quota')}:</span>
                <div className="flex">
                    <Dropdown
                        options={quotas}
                        optionLabel="name"
                        value={selectedQuota}
                        onChange={(e) => handleSelectQuota(e.value)}
                        itemTemplate={(item) => <TooltipDropdownItem item={item} />}
                    />
                    <ActionAccessComponent action={ActionType.EditCategoriesAll} >
                        <Button
                            className="pi pi-plus p-2"
                            text
                            onClick={handleInsertQuota}
                        />
                    </ActionAccessComponent>
                </div>
            </div>
        );
    }

    if (editMode) {
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
                        onValueChange={(e) => setPagesCount(e.target.value!)} 
                    />
                </div>
                <div className="flex justify-content-end gap-2">
                    <Button outlined severity="success" onClick={handleAcceptChanges}>
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
                    onChange={(e) => handleSelectQuota(e.value)}
                    itemTemplate={(item) => <TooltipDropdownItem item={item} />}
                />
                <ActionAccessComponent action={ActionType.EditCategoriesAll} >
                    <Button
                        className="pi pi-plus p-2"
                        text
                        onClick={handleInsertQuota}
                    />
                </ActionAccessComponent>
            </div>
            <span className="font-bold">{t('pages_count')}: {selectedQuota.pages_count}</span>
            {selectedQuota.active &&
            <span className="font-bold text-yellow-800">{t('active_quota')}</span>}
            <ActionAccessComponent action={ActionType.EditCategoriesAll} >
                <div className="flex justify-content-end gap-2">
                    {!selectedQuota.active &&
                    <Button
                        className="text-yellow-800"
                        outlined
                        tooltip={t('set_active_quota')}
                        onClick={handleSetActiveQuota}
                    >
                        <i className="pi pi-star-fill" />
                    </Button>}
                    <Button outlined onClick={handleEditQuota}>
                        <i className="pi pi-pencil" />
                    </Button>
                    <Button outlined severity="danger" onClick={handleDeleteQuota}>
                        <i className="pi pi-trash" />
                    </Button>
                </div>
            </ActionAccessComponent>
        </div>
    );
};

export default QuotasMenuPanel;
