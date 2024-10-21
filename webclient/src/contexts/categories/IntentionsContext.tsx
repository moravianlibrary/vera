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
import { useToast } from "../ToastContext";
import { useTranslation } from "react-i18next";
import { IntentionClassification } from "../../types/IntentionClassification";
import IntentionValidator from "../../data/validators/IntentionValidator";
import { useNotification } from "../NotificationContext";

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
    const { t } = useTranslation("intentions");
    const { showSuccess, showFailure } = useNotification();

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
        console.debug(`Fetching intentions from server.`);
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
                showFailure(messageHeader, t("actions.failure.empty-name"));
                return false;
            }
            if (!IntentionValidator.hasValidTargetPageCount(intention)) {
                showFailure(
                    messageHeader,
                    t("actions.failure.invalid-page-count")
                );
                return false;
            }

            if (!currentIntention || intentionId !== currentIntention.id) {
                if (!IntentionValidator.hasDateRangeAfterToday(intention)) {
                    showFailure(
                        messageHeader,
                        t("actions.failure.invalid-start-date")
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
                    showFailure(
                        messageHeader,
                        t("actions.failure.curr-start-date-change")
                    );
                    return false;
                }
                if (!IntentionValidator.hasEndDateAfterToday(intention)) {
                    showFailure(
                        messageHeader,
                        t("actions.failure.date-range-overlap")
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
                showFailure(messageHeader, t("actions-failure.unique-name"));
                return false;
            }
            if (
                !IntentionValidator.hasNonOverlappingDateRange(
                    intention,
                    intentions,
                    intentionId
                )
            ) {
                showFailure(
                    messageHeader,
                    t("actions.failure.date-range-overlap")
                );
                return false;
            }
        }
        return true;
    };

    const createIntention = (intention: IntentionCreate) => {
        if (!validateIntention(intention, t("actions.failure.create"))) {
            return;
        }
        ApiCategories.createIntention(intention)
            .then((response) => {
                const newIntention = response.data;
                showSuccess(
                    t("actions.success.create"),
                    t("actions.success.create-details", {
                        name: newIntention.name,
                        count: newIntention.target_page_count,
                    })
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
                    showFailure(
                        t("actions.failure.create"),
                        t("actions.failure.create-details", {
                            name: intention.name,
                            count: intention.target_page_count,
                        })
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
                t("actions.failure.update"),
                intentionId
            )
        ) {
            return;
        }
        ApiCategories.updateIntention(intentionId, intention)
            .then((response) => {
                const updatedIntention: Intention = response.data;
                showSuccess(
                    t("actions.success.update"),
                    t("actions.success.update-details", {
                        name: updatedIntention.name,
                        count: updatedIntention.target_page_count,
                    })
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
                    showFailure(
                        t("actions.failure.update"),
                        t("actions.failure.update-details", {
                            name: intention.name,
                            count: intention.target_page_count,
                        })
                    );
                } else {
                    console.error(error);
                }
            });
    };

    const deleteIntention = (intentionId: number) => {
        ApiCategories.deleteIntention(intentionId)
            .then((response) => {
                showSuccess(t("actions.success.delete"));
                setIntentions(
                    intentions?.filter((q) => q.id !== response.data.id)
                );
            })
            .catch((error) => {
                showFailure(t("actions.failure.delete"));
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
