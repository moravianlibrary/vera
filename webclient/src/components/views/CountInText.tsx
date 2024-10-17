import { useTranslation } from "react-i18next";

interface CountInTextProps {
    textKey: string;
    textNs?: string;
    count: number;
    condition?: (count: number) => boolean;
    className?: string;
}

const CountInText: React.FC<CountInTextProps> & {
    GreaterThanZero: React.FC<CountInTextProps>;
} = ({ textKey, textNs, count, condition = () => true, className = "" }) => {
    const { t } = useTranslation(textNs);

    if (!condition(count)) {
        return null;
    }

    return (
        <span
            className={className}
            dangerouslySetInnerHTML={{
                __html: t(textKey, {
                    count,
                }),
            }}
        />
    );
};

const GreaterThanZero: React.FC<CountInTextProps> = ({ ...props }) => {
    return <CountInText {...props} condition={(c) => c > 0} />;
};

CountInText.GreaterThanZero = GreaterThanZero;

export default CountInText;
