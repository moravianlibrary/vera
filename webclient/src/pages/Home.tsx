import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import "../styles/Wiki.css";
import { BreadCrumb } from "primereact/breadcrumb";
import { PanelMenu } from "primereact/panelmenu";
import { MenuItem } from "primereact/menuitem";

interface WikiPage {
    label: string;
    content: string;
}

interface WikiSection {
    label: string;
    children: (WikiPage | WikiSection)[];
}

const language = "cs";

const RENDERERS = {
    a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    ),
    img: ({ src, alt }) => (
        <img
            src={`/wiki/${language}/${src}`}
            alt={alt}
            style={{ display: "block" }}
        />
    ),
};

const Wiki: React.FC = () => {
    const [pages, setPages] = useState<Record<string, string>>({});
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [currentPath, setCurrentPath] = useState<string[]>([]);
    const [currentContent, setCurrentContent] = useState<string>("");

    const fetchWikiPageContent = async (
        language: string,
        content: string
    ): Promise<string | null> => {
        try {
            const response = await fetch(`/wiki/${language}/${content}`);
            return await response.text();
        } catch (error) {
            console.error("Error fetching Markdown:", error);
            return null;
        }
    };

    const fetchWikiLayout = async (language: string) => {
        const response = await fetch(`/wiki/${language}/layout.json`);
        const layout: WikiSection[] = await response.json();

        const pages: Record<string, string> = {};

        const transformSection = async (
            section: WikiSection | WikiPage,
            path: string[] = []
        ): Promise<MenuItem> => {
            if ("children" in section) {
                return {
                    label: section.label,
                    items: await Promise.all(
                        section.children.map((child) =>
                            transformSection(child, [...path, section.label])
                        )
                    ),
                };
            }

            const currentPath = [...path, section.label];
            pages[currentPath.join("/")] = await fetchWikiPageContent(
                language,
                section.content
            );
            return {
                label: section.label,
                command: () => setCurrentPath(currentPath),
            };
        };

        setMenuItems(
            await Promise.all(
                layout.map((section) => transformSection(section))
            )
        );
        setPages(pages);
        setCurrentPath([layout[0].label]);
    };

    useEffect(() => {
        fetchWikiLayout(language);
    }, [language]);

    useEffect(() => {
        setCurrentContent(pages[currentPath.join("/")]);
    }, [currentPath, pages]);

    const breadcrumbItems = currentPath.map((pageName, index) => ({
        label: pageName,
        icon: "pi pi-home",
        command: () => setCurrentPath(currentPath.slice(0, index + 1)),
    }));

    return (
        <div className="iwiki">
            <BreadCrumb className="bread-crumb" model={breadcrumbItems} />
            <PanelMenu className="panel-menu" model={menuItems} multiple />
            <div className="content">
                <Markdown components={RENDERERS}>{currentContent}</Markdown>
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
export { RENDERERS };
