# Document Lifecycle

The lifecycle of a document in VERA spans from proposal submission to completed digitization.

## Stages

1. **Proposal** → An identifier is submitted for consideration
2. **Eligibility** → Automatic checks against catalog and existing records
3. **Review** → Human reviewer approves/rejects the proposal
4. **Addition** → Approved proposal creates an addition record
5. **Document** → Addition is processed into a document record
6. **Validation** → Document passes automated and manual validation
7. **Digitization** → Physical scanning and processing
8. **Quality Check** → Final QC before publication
9. **Done** → Published to Kramerius or target system

## Key Transitions

| From | To | Trigger | Reversible |
|------|----|---------|------------|
| Proposal → Addition | Reviewer approves | No |
| Addition → Document | Automatic (hook) | No |
| Document → Approved | Validator approves | Yes (can re-reject) |
| Approved → In Progress | Operator starts | No |
| In Progress → Done | QC passes | No |
