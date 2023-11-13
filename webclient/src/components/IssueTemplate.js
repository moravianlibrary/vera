import { useTranslation } from "react-i18next";

const IssueTemplate = (props) => {
    const { t } = useTranslation();
    const { issue } = props;
    const { onClick } = props;

    return (
        <div className="col">
            <div className="p-3 border-2 surface-border surface-card border-round"
                style={{ cursor: 'pointer', margin: '2px' }}
                onClick={e => onClick(issue)}
            >
                <h4>{t(issue.issuanceType)}</h4>
                <div>{t('signature')}: {issue.signature}</div>
                <div>{t('barcode')}: {issue.barcode}</div>
                {issue.yearIssued && <div>{t('year_issued')}: {issue.yearIssued}</div>}
                {issue.volume && <div>{t('volume')}: {issue.volume}</div>}
                {issue.item && <div>{t('item')}: {issue.item}</div>}
            </div>
        </div>
    );
};

export default IssueTemplate;