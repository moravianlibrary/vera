export function buildTermsAggregation(field: string, models: any[]) {
    const counts: Record<string, number> = {};

    models.forEach((m) => {
        const key = m.attrs[field] ?? "undefined";

        if (Array.isArray(key)) {
            key.forEach((k) => {
                counts[k] = (counts[k] || 0) + 1;
            });
            return;
        }

        counts[key] = (counts[key] || 0) + 1;
    });

    return {
        buckets: Object.entries(counts).map(([key, doc_count]) => ({
            key,
            doc_count,
        })),
        sum_other_doc_count: 0,
        doc_count_error_upper_bound: 0,
    };
}
