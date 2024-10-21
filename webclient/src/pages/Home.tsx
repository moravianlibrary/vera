import { Button } from "primereact/button";
import { Panel } from "primereact/panel";
import React from "react";
import { useEffect, useState } from "react";
import { Toolbar } from "primereact/toolbar";
import Markdown from "react-markdown";

interface WikiProps {
    language: string;
}

const Wiki: React.FC<WikiProps> = ({ language }) => {
    const [page, setPage] = useState<string>("Home.md");
    const [markdownContent, setMarkdownContent] = useState<string>();
    const [history, setHistory] = useState<string[]>(["Home.md"]);
    const [historyIndex, setHistoryIndex] = useState<number>(0);

    const fetchMarkdown = async () => {
        if (page) {
            try {
                const response = await fetch(
                    `${process.env.PUBLIC_URL}/wiki/${language}/${page}`
                );
                const content = await response.text();
                setMarkdownContent(content);
            } catch (error) {
                console.error("Error fetching Markdown:", error);
            }
        }
    };

    const handleClickOnPage = (page) => {
        setPage(page);
        setHistory([...history, page]);
        setHistoryIndex(historyIndex + 1);
    };

    const handleGoBack = () => {
        setPage(history[historyIndex - 1]);
        setHistoryIndex(historyIndex - 1);
    };

    const handleGoNext = () => {
        setPage(history[historyIndex + 1]);
        setHistoryIndex(historyIndex + 1);
    };

    useEffect(() => {
        fetchMarkdown();
    }, [language, page]);

    const renderLink = (props: any) => {
        if ((props.href as string).endsWith(".md")) {
            return (
                <Button
                    text
                    className="p-button-link"
                    style={{ fontSize: "inherit", padding: 0, margin: 0 }}
                    onClick={() => handleClickOnPage(props.href)}
                >
                    {props.children}
                </Button>
            );
        }
        return <a {...props} target="_blank" />;
    };

    const renderImage = (props: any) => {
        const imageUrl = `${process.env.PUBLIC_URL}/wiki/${language}/${props.src}`;
        return (
            <img src={imageUrl} alt={props.alt} style={{ display: "block" }} />
        );
    };

    const wikiToolbar: React.FC = () => {
        return (
            <div className="flex gap-3 align-items-center">
                <img src="/logo32.svg" />
                <strong style={{ fontSize: "1.5em" }}>Wiki</strong>
                <div className="p-inputgroup">
                    <Button
                        className="pi pi-home"
                        outlined
                        disabled={page === "Home.md"}
                        onClick={() => handleClickOnPage("Home.md")}
                    />
                    <Button
                        className="pi pi-chevron-left"
                        outlined
                        disabled={historyIndex === 0}
                        onClick={handleGoBack}
                    />
                    <Button
                        className="pi pi-chevron-right"
                        outlined
                        disabled={historyIndex === history.length - 1}
                        onClick={handleGoNext}
                    />
                </div>
            </div>
        );
    };

    const wikiHeader: React.FC = () => {
        return <Toolbar start={wikiToolbar} />;
    };

    return (
        <Panel className="wiki" headerTemplate={wikiHeader}>
            <Markdown components={{ a: renderLink, img: renderImage }}>
                {markdownContent}
            </Markdown>
        </Panel>
    );
};

const Home: React.FC = () => {
    return (
        <div>
            <Wiki language="cs" />
        </div>
    );
};

export default Home;
