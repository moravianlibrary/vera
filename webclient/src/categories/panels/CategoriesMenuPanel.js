import { Button } from "primereact/button";
import { Divider } from "primereact/divider";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const CategoriesMenuPanel = (props) => {
    const { t } = useTranslation();
    const [insertMode, setInsertMode] = useState(false);

    const handleShowAllCategories = (e) => {
        if (props.onShowAllCategories) {
            props.onShowAllCategories(e);
        }
    };

    const handleTogleInsertMode = (e) => {
        if (props.onToggleInsertMode) {
            props.onToggleInsertMode(!insertMode);
        }
        setInsertMode(!insertMode);
    };

    const floatingPanelStyle = {
        position: 'fixed',
        top: '70px',
        left: '20px',
        zIndex: '1000',
        boxShadow: '0px 0px 10px 0px rgba(0,0,0,0.35)',
        margin: '0px',
        padding: '0px',
    };

    return (
        <div className="flex flex-column bg-white p-1" style={floatingPanelStyle}>
            <Button
                className="m-0 bg-cyan-400 text-800"
                text
                icon="pi pi-eye"
                label={t('show_all_categories')}
                onClick={handleShowAllCategories}
            />
            <Divider className="m-0" />
            <Button
                className={insertMode ? "m-0 bg-blue-100 text-800" : "m-0 text-800"}
                text
                icon="pi pi-eye"
                label={t('insert_mode')}
                onClick={handleTogleInsertMode}
            />
        </div>
    );
};

export default CategoriesMenuPanel;
