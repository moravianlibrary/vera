import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiCategories, { CreateQuota, Quota } from "../../adapters/ApiCategories";
import { useToast } from "../toast/ToastContext";
import { useTranslation } from "react-i18next";

type QuotaUpdateParams = {
    name: string;
    description?: string;
    pages_count: number;
};

interface QuotasContextProps {
    quotas: Quota[] | undefined;
    selectedQuota: Quota | undefined;
    handleSelectQuota: (quota: Quota) => void;
    handleCreateQuota: (params: QuotaUpdateParams) => void;
    handleUpdateQuota: (params: QuotaUpdateParams) => void;
    handleSetActiveQuota: () => void;
    handleDeleteQuota: () => void;
}

const QuotasContext = createContext<QuotasContextProps | undefined>(undefined);

interface QuotasProviderProps {
    children: ReactNode;
}

export const QuotasProvider: React.FC<QuotasProviderProps> = ({ children }) => {
    const { t } = useTranslation();
    const showToast = useToast();
    
    const [quotas, setQuotas] = useState<Quota[] | undefined>(undefined);
    const [selectedQuota, setSelectedQuota] = useState<Quota | undefined>(undefined);

    const loadQuotas = async () => {
        ApiCategories.getQuotas()
        .then(response => {
            const transformedData: Quota[] = response.data.map(quota => {
                return Object.assign({}, quota) as Quota;
            });
            setSelectedQuota(transformedData.find(q => q.active));
            setQuotas(transformedData);
        }).catch(error => {
            console.error(`Could not receive quotas: ${error}`);
        });
    };

    useEffect(() => {
        console.log(`Fetching quotas from server.`);
        loadQuotas();
    }, []);
    
    const handleSelectQuota = (quota: Quota) => {
        setSelectedQuota(quota);
    };

    const handleCreateQuota = (params: QuotaUpdateParams) => {
        ApiCategories.createQuota(params as CreateQuota)
        .then(response => {
            const newQuota = response.data;
            showToast("success", t("The quota was created successfully"),
                `${t("Name")}: ${newQuota.name}, ${t("Pages count")}: ${newQuota.pages_count}`);
            if (quotas) {
                setQuotas([...quotas, newQuota])
            } else {
                setQuotas([newQuota])
            }
        }).catch(error => {
            if (400 <= error.response?.status && error.response?.status < 500) {
                showToast("error", t("Quota creation failed"), t(error.response.data.detail));
            } else {
                console.error(error);
            }
        });
    };

    const handleUpdateQuota = (params: QuotaUpdateParams) => {
        console.log(selectedQuota);
        console.log(params);
        if (params.name === selectedQuota?.name
                && (params.description === undefined && selectedQuota.description === null
                    || params.description === selectedQuota.description)
                && params.pages_count === selectedQuota.pages_count) {
            showToast("info", t("The quota has not changed"), "");
            setQuotas([...quotas!]);
            return;
        }

        const updateQuota = {
            id: selectedQuota!.id,
            ...params
        }
        ApiCategories.updateQuota(updateQuota)
        .then(response => {
            const updatedQuota: Quota = response.data;
            showToast("success", t("The quota was updated successfully"),
                `${t("Name")}: ${updatedQuota.name}, ${t("Pages count")}: ${updatedQuota.pages_count}`);
            const updatedQuotas = quotas?.map(q => q.id === updatedQuota.id ? updatedQuota : q);
            setSelectedQuota(updatedQuota);
            setQuotas(updatedQuotas);
        }).catch(error => {
            if (400 <= error.response?.status && error.response?.status < 500) {
                showToast("error", t("Quota update failed"), t(error.response.data.detail));
            } else {
                console.error(error);
            }
        });
    };

    const handleDeleteQuota = () => {
        if (selectedQuota?.active) {
            showToast("warn", t("Quota deletion failed"), t("An active quota cannot be deleted"));
            return;
        }
        ApiCategories.deleteQuota(selectedQuota!.id)
        .then(response => {
            showToast("success", t("The quota was deleted successfully"),
                `${t("Name")}: ${selectedQuota!.name}, ${t("Pages count")}: ${selectedQuota!.pages_count}`);
            setQuotas(quotas?.filter(q => q.id !== selectedQuota!.id));
            setSelectedQuota(quotas!.find(q => q.active));
        }).catch(error => {
            showToast("error", t("Quota deletion failed"), "");
            console.error(error);
        })
    };

    const handleSetActiveQuota = () => {
        const updateQuota = {
            ...selectedQuota!,
            active: true
        }
        ApiCategories.updateQuota(updateQuota)
        .then(response => {
            const updatedQuota: Quota = response.data;
            showToast("success", t("The quota has been successfully set as active"), "");
            const updatedQuotas = quotas?.map(q => q.id === updatedQuota.id ? updatedQuota : { ...q, active: false });
            setSelectedQuota(updatedQuota);
            setQuotas(updatedQuotas);
        }).catch(error => {
            if (400 <= error.response?.status && error.response?.status < 500) {
                showToast("error", t("Quota update failed"), t(error.response.data.detail));
            } else {
                console.error(error);
            }
        });
    }

    const contextValue: QuotasContextProps = {
        quotas,
        selectedQuota,
        handleSelectQuota,
        handleCreateQuota,
        handleUpdateQuota,
        handleSetActiveQuota,
        handleDeleteQuota,
    };

    return (
        <QuotasContext.Provider value={contextValue}>
            {children}
        </QuotasContext.Provider>
    );
};

export const useQuotas = (): QuotasContextProps => {
    const context = useContext(QuotasContext);

    if (!context) {
        throw new Error('useQuotas must be used within a QuotasProvider');
    }

    return context;
};
