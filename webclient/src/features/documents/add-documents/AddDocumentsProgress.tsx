import { useTranslation } from "react-i18next";
import { useAddDocuments } from "../../../contexts/AddDocumentsContext";
import { Badge } from "primereact/badge";
import { ProgressSpinner } from "primereact/progressspinner";

interface AddDocumentsProgressProps {
    column?: boolean;
}

const AddDocumentsProgress: React.FC<AddDocumentsProgressProps> = ({
    column,
}) => {
    const { t } = useTranslation("documents");
    const { numProcessed, numFound } = useAddDocuments();

    if (numFound === 0) return null;

    if (column) {
        return (
            <div className="flex align-items-center">
                <Badge
                    className="surface-50 text-gray-600 white-space-nowrap"
                    value={t("add.progress", { numProcessed, numFound })}
                />
                {numProcessed !== numFound && (
                    <ProgressSpinner
                        style={{ width: "16px", height: "16px" }}
                        strokeWidth="8"
                        fill="var(--surface-ground)"
                        animationDuration="1s"
                    />
                )}
            </div>
        );
    }

    return (
        <div className="flex align-items-center gap-1">
            <span className="text-gray-600 white-space-nowrap">
                {t("add.progress", { numProcessed, numFound })}
            </span>
            {numProcessed !== numFound && (
                <ProgressSpinner
                    style={{ width: "22px", height: "22px" }}
                    strokeWidth="8"
                    fill="var(--surface-ground)"
                    animationDuration="1s"
                />
            )}
        </div>
    );
};

export default AddDocumentsProgress;
