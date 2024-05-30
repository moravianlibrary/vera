import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiCategories, {
    IntentionCreate,
    Intention,
} from "../../adapters/ApiCategories";
import { useToast } from "../toast/ToastContext";
import { useTranslation } from "react-i18next";
import { IntentionClassification } from "../../types/IntentionClassification";

interface IntentionsContextProps {
    intentions: Intention[] | undefined;
    activeIntention: Intention | undefined;
    handleSelectIntention: (intention: Intention) => void;
    handleCreateIntention: (params: IntentionCreate) => void;
    handleUpdateIntention: (params: IntentionCreate) => void;
    handleDeleteIntention: () => void;
}

const IntentionsContext = createContext<IntentionsContextProps | undefined>(
    undefined
);

interface IntentionsProviderProps {
    children: ReactNode;
}

export const IntentionsProvider: React.FC<IntentionsProviderProps> = ({
    children,
}) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const [intentions, setIntentions] = useState<Intention[] | undefined>(
        undefined
    );
    const [activeIntention, setActiveIntention] = useState<
        Intention | undefined
    >(undefined);

    const loadIntentions = async () => {
        ApiCategories.getIntentions()
            .then((response) => {
                const transformedData: Intention[] = response.data.map(
                    (intention) => {
                        return Object.assign({}, intention) as Intention;
                    }
                );
                setActiveIntention(
                    transformedData.find(
                        (intention) =>
                            intention.classification ===
                            IntentionClassification.Current
                    )
                );
                setIntentions(transformedData);
            })
            .catch((error) => {
                console.error(`Could not receive intentions: ${error}`);
            });
    };

    useEffect(() => {
        console.log(`Fetching intentions from server.`);
        loadIntentions();
    }, []);

    const handleSelectIntention = (intention: Intention) => {
        setActiveIntention(intention);
    };

    const handleCreateIntention = (intention: IntentionCreate) => {
        ApiCategories.createIntention(intention)
            .then((response) => {
                const newIntention = response.data;
                showToast(
                    "success",
                    t("The intention was successfully created"),
                    `${t("Name")}: ${newIntention.name}, ${t(
                        "Target page count"
                    )}: ${newIntention.target_page_count}`
                );
                if (intentions) {
                    setIntentions([...intentions, newIntention]);
                } else {
                    setIntentions([newIntention]);
                }
            })
            .catch((error) => {
                if (
                    400 <= error.response?.status &&
                    error.response?.status < 500
                ) {
                    showToast(
                        "error",
                        t("Intention creation failed"),
                        t(error.response.data.detail)
                    );
                } else {
                    console.error(error);
                }
            });
    };

    const handleUpdateIntention = (intention: IntentionCreate) => {
        ApiCategories.updateIntention(activeIntention!.id, intention)
            .then((response) => {
                const updatedIntention: Intention = response.data;
                showToast(
                    "success",
                    t("The intention was successfully updated"),
                    `${t("Name")}: ${updatedIntention.name}, ${t(
                        "Pages count"
                    )}: ${updatedIntention.target_page_count}`
                );
                const updatedIntentions = intentions?.map((q) =>
                    q.id === updatedIntention.id ? updatedIntention : q
                );
                setActiveIntention(updatedIntention);
                setIntentions(updatedIntentions);
            })
            .catch((error) => {
                if (
                    400 <= error.response?.status &&
                    error.response?.status < 500
                ) {
                    showToast(
                        "error",
                        t("Intention update failed"),
                        t(error.response.data.detail)
                    );
                } else {
                    console.error(error);
                }
            });
    };

    const handleDeleteIntention = () => {
        if (!activeIntention) {
            return;
        }
        ApiCategories.deleteIntention(activeIntention.id)
            .then((response) => {
                showToast(
                    "success",
                    t("The intention was deleted successfully"),
                    `${t("Name")}: ${response.data.name}, ${t(
                        "Pages count"
                    )}: ${response.data.target_page_count}`
                );
                setIntentions(
                    intentions?.filter((q) => q.id !== response.data.id)
                );
            })
            .catch((error) => {
                showToast("error", t("Intention deletion failed"), "");
                console.error(error);
            });
    };

    const contextValue: IntentionsContextProps = {
        intentions,
        activeIntention,
        handleSelectIntention,
        handleCreateIntention,
        handleUpdateIntention,
        handleDeleteIntention,
    };

    return (
        <IntentionsContext.Provider value={contextValue}>
            {children}
        </IntentionsContext.Provider>
    );
};

export const useIntentions = (): IntentionsContextProps => {
    const context = useContext(IntentionsContext);

    if (!context) {
        throw new Error(
            "useIntentions must be used within a IntentionsProvider"
        );
    }

    return context;
};
