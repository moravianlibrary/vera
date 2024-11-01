import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import "../../styles/IWiki.css";
import { Button } from "primereact/button";
import { longFormatters } from "date-fns";

interface WikiPageLayout {
    label: string;
    main?: boolean;
    right?: string | string[];
    bottom?: string | string[];
    left?: string | string[];
    top?: string | string[];
}

type WikiLayout = {
    [key: string]: WikiPageLayout;
};

interface WikiPage {
    layout: WikiPageLayout;
    content: string;
}

const IWiki: React.FC = () => {
    const [settings, setSettings] = useState<WikiLayout>({});
    const [currPage, setCurrPage] = useState<WikiPage | null>(null);

    const fetchMarkdown = async (language: string, wikiPage: string) => {
        try {
            return (
                await fetch(
                    `${process.env.PUBLIC_URL}/wiki/${language}/${wikiPage}.md`
                )
            ).text();
        } catch (error) {
            console.error("Error fetching Markdown:", error);
        }
    };

    const changePage = async (wikiPage: string) => {
        setCurrPage({
            layout: settings[wikiPage],
            content: await fetchMarkdown("cs", wikiPage),
        });
    };

    useEffect(() => {
        (async () => {
            try {
                const response = await fetch(
                    `${process.env.PUBLIC_URL}/wiki/layout.json`
                );
                const fetchedSettings = await response.json();
                setSettings(fetchedSettings);
            } catch (error) {
                console.error("Error fetching settings:", error);
            }
        })();
    }, []);

    useEffect(() => {
        if (!settings) return;
        changePage("Home");
    }, [settings]);

    useEffect(() => {
        console.log(currPage);
    }, [currPage]);

    if (!currPage) return null;

    const getPositionPages = (position: string) => {
        if (!currPage.layout) return [];
        return position in currPage.layout
            ? Array.isArray(currPage.layout[position])
                ? currPage.layout[position]
                : [currPage.layout[position]]
            : [];
    };

    return (
        <div className="iwiki">
            <div className="content">
                <Markdown>{currPage.content}</Markdown>
            </div>
            <div className="top-buttons">
                {getPositionPages("top").map((page, index) => (
                    <Button key={index} />
                ))}
            </div>
            <div className="right-buttons">
                {getPositionPages("right").map((page, index) => (
                    <Button
                        key={index}
                        className="w-min"
                        label={settings[page].label}
                        onClick={() => changePage(page)}
                    />
                ))}
            </div>
            <div className="bottom-buttons"></div>
            <div className="left-buttons"></div>
        </div>
    );
};

export default IWiki;
