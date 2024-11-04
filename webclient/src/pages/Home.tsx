import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import "../styles/Wiki.css";
import { BreadCrumb } from "primereact/breadcrumb";
import { PanelMenu } from "primereact/panelmenu";
import { MenuItem } from "primereact/menuitem";

interface WikiPage {
    name: string;
    sub_pages: string[];
    prev_page?: string;
    content: string;
}

const language = "cs";
const homePageName = "Home";

const Wiki: React.FC = () => {
    const [pages, setPages] = useState<Record<string, WikiPage>>({});
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
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
        const pagesToLoad: Record<string, WikiPage> = {};

        const fetchPageAndSubPages = async (
            pageKey: string,
            pagePath: string[]
        ) => {
            const page = await fetchWikiPage(language, pageKey);

            pagesToLoad[pageKey] = page;

            const menuItems: MenuItem[] = [];

            for (const subPage of page.sub_pages) {
                if (!pagesToLoad[subPage] && !pages[subPage]) {
                    menuItems.push(
                        await fetchPageAndSubPages(subPage, [
                            ...pagePath,
                            pageKey,
                        ])
                    );
                }
            }

            return menuItems.length > 0
                ? { label: page.name, items: menuItems }
                : {
                      label: page.name,
                      command: () => setCurrentPath([...pagePath, pageKey]),
                  };
        };

        const menuItems = await fetchPageAndSubPages(wikiPage, []);

        setPages(pagesToLoad);
        setMenuItems(menuItems.items! as MenuItem[]);
    };

    useEffect(() => {
        loadAllPages(homePageName);
    }, [homePageName]);

    useEffect(() => {
        const currentPageName = currentPath[currentPath.length - 1];
        setCurrentContent(pages[currentPageName]?.content || "");
    }, [currentPath, pages]);

    const breadcrumbItems = currentPath.slice(1).map((pageName, index) => ({
        label: pages[pageName]?.name || pageName,
        command: () => setCurrentPath(currentPath.slice(0, index + 1)),
    }));
    const home = {
        icon: "pi pi-home",
        command: () => setCurrentPath([homePageName]),
    };

    const renderers = {
        link: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
            </a>
        ),
    };

    return (
        <div className="iwiki">
            <BreadCrumb
                className="bread-crumb"
                model={breadcrumbItems}
                home={home}
            />
            <PanelMenu
                className="panel-menu"
                model={menuItems}
                expandedKeys={[]}
                onExpandedKeysChange={null}
                multiple
            />
            <div className="content">
                <Markdown components={renderers}>{currentContent}</Markdown>
            </div>
        </div>
    );
};

const Home: React.FC = () => {
    return (
        <div className="w-full h-full">
            <Wiki />
        </div>
    );
};

export default Home;
