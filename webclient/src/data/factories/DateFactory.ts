import { format } from "date-fns";

function formatDatetime(datetime: string): string {
    return format(new Date(datetime), "dd.MM.yyyy HH:mm:ss");
}

export { formatDatetime };
