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
import IntentionValidator from "../../data/validators/IntentionValidator";

interface IntentionsContextProps {
    intentions: Intention[];
    activeIntention: Intention | null;
    selectIntention: (intention: Intention | null) => void;
    createIntention: (params: IntentionCreate) => void;
    updateIntention: (params: IntentionCreate, intentionId: number) => void;
    deleteIntention: (intentionId: number) => void;
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

    const [intentions, setIntentions] = useState<Intention[]>([]);
    const [currentIntention, setCurrentIntention] = useState<Intention | null>(
        null
    );
    const [activeIntention, setActiveIntention] = useState<Intention | null>(
        null
    );

    const loadIntentions = async () => {
        ApiCategories.getIntentions()
            .then((response) => {
                const transformedData: Intention[] = response.data.map(
                    (intention) => {
                        return Object.assign({}, intention) as Intention;
                    }
                );
                const currentIntention =
                    transformedData.find(
                        (intention) =>
                            intention.classification ===
                            IntentionClassification.Current
                    ) || null;
                setCurrentIntention(currentIntention);
                setActiveIntention(currentIntention);
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

    const selectIntention = (intention: Intention | null) => {
        setActiveIntention(intention);
    };

    const validateIntention = (
        intention: IntentionCreate,
        messageHeader: string,
        intentionId?: number
    ): boolean => {
        if (intentions) {
            if (!IntentionValidator.hasValidName(intention)) {
                showToast(
                    "error",
                    messageHeader,
                    t("Intention name must not be empty")
                );
                return false;
            }
            if (!IntentionValidator.hasValidTargetPageCount(intention)) {
                showToast(
                    "error",
                    messageHeader,
                    t("Intention target page count must be positive")
                );
                return false;
            }

            if (!currentIntention || intentionId !== currentIntention.id) {
                if (!IntentionValidator.hasDateRangeAfterToday(intention)) {
                    showToast(
                        "error",
                        messageHeader,
                        t("Intention date range must start today or later")
                    );
                    return false;
                }
            } else {
                if (
                    !IntentionValidator.hasSameStartDate(
                        intention,
                        currentIntention
                    )
                ) {
                    showToast(
                        "error",
                        messageHeader,
                        t("Current intention start date must not be changed")
                    );
                    return false;
                }
                if (!IntentionValidator.hasEndDateAfterToday(intention)) {
                    showToast(
                        "error",
                        messageHeader,
                        t(
                            "Current intention date range must end today or later"
                        )
                    );
                    return false;
                }
            }

            if (
                !IntentionValidator.hasUniqueName(
                    intention,
                    intentions,
                    intentionId
                )
            ) {
                showToast(
                    "error",
                    messageHeader,
                    t("Intention name must be unique")
                );
                return false;
            }
            if (
                !IntentionValidator.hasNonOverlappingDateRange(
                    intention,
                    intentions,
                    intentionId
                )
            ) {
                showToast(
                    "error",
                    messageHeader,
                    t("Intention date range must not overlap")
                );
                return false;
            }
        }
        return true;
    };

    const createIntention = (intention: IntentionCreate) => {
        if (
            !validateIntention(
                intention,

                t("Intention creation failed")
            )
        ) {
            return;
        }
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

    const updateIntention = (
        intention: IntentionCreate,
        intentionId: number
    ) => {
        if (
            !validateIntention(
                intention,
                t("Intention update failed"),
                intentionId
            )
        ) {
            return;
        }
        ApiCategories.updateIntention(intentionId, intention)
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

    const deleteIntention = (intentionId: number) => {
        ApiCategories.deleteIntention(intentionId)
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
        selectIntention,
        createIntention,
        updateIntention,
        deleteIntention,
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
