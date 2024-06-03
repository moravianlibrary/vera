import { Intention, IntentionCreate } from "../../adapters/ApiCategories";

class IntentionValidator {
    static hasValidName(intention: IntentionCreate): boolean {
        return intention.name.length > 0;
    }

    static hasValidTargetPageCount(intention: IntentionCreate): boolean {
        return intention.target_page_count > 0;
    }

    static hasDateRangeAfterToday(intention: IntentionCreate): boolean {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(intention.start_date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(intention.end_date);
        endDate.setHours(0, 0, 0, 0);
        return today <= startDate && today <= endDate;
    }

    static hasSameStartDate(intention: IntentionCreate, currentIntention: Intention): boolean {
        return intention.start_date === currentIntention.start_date;
    }

    static hasEndDateAfterToday(intention: IntentionCreate): boolean {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endDate = new Date(intention.end_date);
        endDate.setHours(0, 0, 0, 0);
        return today <= endDate;
    }

    static hasUniqueName(intention: IntentionCreate, intentions: Intention[], intentionId?: number): boolean {
        return intentions.find((i) => i.name === intention.name && i.id !== intentionId) ? false : true;
    }

    static hasNonOverlappingDateRange(intention: IntentionCreate, intentions: Intention[], intentionId?: number): boolean {
        return intentions
            .find((i) => i.id !== intentionId && i.start_date <= intention.end_date && i.end_date >= intention.start_date) ? false : true;
    }
}

export default IntentionValidator;
