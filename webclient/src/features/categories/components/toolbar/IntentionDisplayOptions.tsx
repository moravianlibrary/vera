import { Button } from "primereact/button";
import React from "react";
import LabeledComponent from "../../../../components/LabeledComponent";
import { useCategoryModels } from "../../../../contexts/categories/CategoryNodesContext";
import { useTranslation } from "react-i18next";
import { useIntentions } from "../../../../contexts/categories/IntentionsContext";
import IntentionPicker from "../../../../components/pickers/IntentionPicker";

interface IntentionsDisplayOptionsProps {}

const IntentionsDisplayOptions: React.FC<
    IntentionsDisplayOptionsProps
> = () => {
    const { t } = useTranslation();
    const { showIntentionOnly, setShowIntentionOnly } = useCategoryModels();
    const { activeIntention, selectIntention } = useIntentions();

    return (
        <div className="card flex ml-2 gap-4 flex-wrap">
            <Button
                className={activeIntention ? "m-0 text-800" : "m-0 bg-primary"}
                text={activeIntention !== null}
                label={t("Without intention")}
                onClick={() => selectIntention(null)}
            />
            <LabeledComponent
                label={t("Selected intention")}
                className="p-button-label text-800 my-2 mx-1 align-items-center"
            >
                <IntentionPicker
                    selectedIntention={activeIntention}
                    onIntentionChange={selectIntention}
                />
            </LabeledComponent>
            {activeIntention !== null && (
                <Button
                    className={
                        showIntentionOnly ? "m-0 bg-primary" : "m-0 text-800"
                    }
                    text={!showIntentionOnly}
                    label={t("Show only intention categories")}
                    onClick={() => setShowIntentionOnly(!showIntentionOnly)}
                />
            )}
        </div>
    );
};

export default IntentionsDisplayOptions;
