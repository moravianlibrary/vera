import { format } from "date-fns";
import { IntentionCreate } from "../../adapters/ApiCategories";

class IntentionFactory {
    static createEmpty(): IntentionCreate {
        return {
            name: "",
            description: "",
            target_page_count: 0,
            start_date: format(new Date(), "yyyy-MM-dd"),
            end_date: format(new Date(), "yyyy-MM-dd"),
        };
    }

    static create(name: string, description: string | null, targetPageCount: number, dateRange: Date[]): IntentionCreate {
        return {
            name: name,
            description: description,
            target_page_count: targetPageCount,
            start_date: format(dateRange[0], "yyyy-MM-dd"),
            end_date: format(dateRange[1], "yyyy-MM-dd"),
        };
    }
}

export default IntentionFactory;
