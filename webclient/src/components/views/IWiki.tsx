import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import "../../styles/IWiki.css";
import { BreadCrumb } from "primereact/breadcrumb";
import { PanelMenu } from "primereact/panelmenu";

interface WikiPage {
    name: string;
    sub_pages: string[];
    prev_page?: string;
    content: string;
}

const language = "cs";
const homePageName = "Home";

const IWiki: React.FC = () => {
    const [pages, setPages] = useState<WikiPage[]>([]);
    const [currentPath, setCurrentPath] = useState<string[]>([homePageName]);
    const [currentContent, setCurrentContent] = useState<string>("");

    const fetchWikiPage = async (
        language: string,
        wikiPage: string
    ): Promise<WikiPage | null> => {
        try {
            const response = await fetch(
                `${process.env.PUBLIC_URL}/wiki/${language}/${wikiPage}.mdw`
            );
            const mdwContent = await response.text();

            const pageAttributesMatch =
                mdwContent.match(/---\n([\s\S]*?)\n---/);
            const pageAttributes = pageAttributesMatch
                ? pageAttributesMatch[1]
                : "";

            const nameMatch = pageAttributes.match(/name:\s*(.+)/);
            const subPagesMatch = [
                ...pageAttributes.matchAll(/sub-page:\s*(.+)/g),
            ];

            const name = nameMatch ? nameMatch[1].trim() : wikiPage;
            const sub_pages = subPagesMatch.map((match) => match[1].trim());

            const content = mdwContent.replace(/---\n[\s\S]*?\n---/, "").trim();

            return { name, sub_pages, content };
        } catch (error) {
            console.error("Error fetching Markdown:", error);
            return null;
        }
    };

    const loadAllPages = async (wikiPage: string) => {
        const page = await fetchWikiPage(language, wikiPage);
        if (page) {
            setPages((prev) => ({ ...prev, [wikiPage]: page }));

            for (const subPage of page.sub_pages) {
                if (!pages[subPage]) await loadAllPages(subPage);
            }
        }
    };

    useEffect(() => {
        loadAllPages(homePageName);
    }, []);

    useEffect(() => {
        console.log(currentPath, pages);

        const currentPageName = currentPath[currentPath.length - 1];
        setCurrentContent(pages[currentPageName]?.content || "");
    }, [currentPath, pages]);

    const breadcrumbItems = currentPath.map((pageName, index) => ({
        label: pages[pageName]?.name || pageName,
        command: () => setCurrentPath(currentPath.slice(0, index + 1)),
    }));
    const home = { icon: "pi pi-home", url: "/" };

    const panelMenuItems =
        currentPath.length === 1
            ? pages[homePageName]?.sub_pages.map((subPage) => ({
                  label: pages[subPage]?.name || subPage,
                  command: () => setCurrentPath((prev) => [...prev, subPage]),
              })) || []
            : pages[currentPath[currentPath.length - 1]]?.sub_pages.map(
                  (subPage) => ({
                      label: pages[subPage]?.name || subPage,
                      command: () =>
                          setCurrentPath((prev) => [...prev, subPage]),
                  })
              ) || [];

    const renderers = {
        link: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
            </a>
        ),
    };

    return (
        <div className="iwiki">
            <BreadCrumb model={breadcrumbItems} home={home} />
            <PanelMenu
                model={panelMenuItems}
                expandedKeys={[]}
                onExpandedKeysChange={null}
                className="w-full md:w-20rem"
                multiple
            />
            <div className="content">
                <Markdown components={renderers}>{currentContent}</Markdown>
            </div>
        </div>
    );
};

export default IWiki;
