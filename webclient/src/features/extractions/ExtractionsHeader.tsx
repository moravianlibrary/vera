import { Button } from "primereact/button";
import React, { useRef, useState } from "react";
import { Toolbar } from "primereact/toolbar";
import { useTranslation } from "react-i18next";
import ExtractionPropsMenu from "./ExtractionPropsMenu";
import { OverlayPanel } from "primereact/overlaypanel";

interface ExtractionsHeaderProps {
}

const ExtractionsHeader: React.FC<ExtractionsHeaderProps> = (props) => {
    const { t } = useTranslation();

    const propsMenuPanel = useRef<OverlayPanel>(null);

    const startContent = (
        <React.Fragment>
            <Button
                icon="pi pi-angle-down" 
                label={t('Generate extraction')}
                outlined
                onClick={(e) => propsMenuPanel.current!.toggle(e)}
            />
            <OverlayPanel ref={propsMenuPanel}>
                <ExtractionPropsMenu/>
            </OverlayPanel>
        </React.Fragment>
    );

    return (
        <div>
            <Toolbar start={startContent} />
        </div>
    );
};

export default ExtractionsHeader;
