
export class Issue {
    signature;
    yearIssued;
    volume;
    item;
    barcode;
    issuanceType;

    static fromJson(jsonData) {
        const issue = new Issue();

        issue.signature = jsonData.signature;
        issue.yearIssued = jsonData.year_issued;
        issue.volume = jsonData.volume;
        issue.barcode = jsonData.barcode;
        issue.issuanceType = jsonData.issuance_type;

        return issue;
    }
}