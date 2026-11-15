import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "@fontsource/ibm-plex-mono/cyrillic-400.css";
import "@fontsource/ibm-plex-mono/cyrillic-500.css";
import "./styles.css";
import { BackToTop, CommandPalette, Footer, SECTIONS, Topbar } from "./components/layout";
import { TableViewer } from "./components/table-viewer";
import { ErrorBox } from "./components/ui";
import { AskPage } from "./pages/ask";
import { AtmospherePage } from "./pages/atmosphere";
import { ComparePage } from "./pages/compare";
import { FlightPage } from "./pages/flight";
import { HomePage } from "./pages/home";
import { AboutPage, EarthPage } from "./pages/info";
import { StudiesPage } from "./pages/studies";
import { StudyPage } from "./pages/study";
import { TablesPage } from "./pages/tables";
import { StoreProvider, useRoute, useStore } from "./store";

function Page({ section, id }: { section: string; id?: string }) {
  switch (section) {
    case "studies":
      return id ? <StudyPage id={id} /> : <StudiesPage />;
    case "atmosphere":
      return <AtmospherePage />;
    case "flight":
      return <FlightPage traceId={id} />;
    case "compare":
      return <ComparePage />;
    case "tables":
      return <TablesPage />;
    case "earth":
      return <EarthPage />;
    case "about":
      return <AboutPage />;
    case "ask":
      return <AskPage />;
    default:
      return <HomePage />;
  }
}

function App() {
  const { loadError, t } = useStore();
  const { parts } = useRoute();
  const [section = "", id] = parts;
  const pageKey = section === "studies" ? `${section}/${id ?? ""}` : section;

  useEffect(() => {
    window.scrollTo(0, 0);
    const known = SECTIONS.find((s) => s.path === section);
    const name = section === "ask" ? t("nav.ask") : known && section ? t(known.key) : null;
    document.title = [id, name, "IGNIS"].filter(Boolean).join(" · ");
  }, [pageKey, section, id, t]);

  return (
    <>
      <Topbar section={section} />
      <main id="main">
        {loadError ? <div className="wrap page-body"><ErrorBox message={loadError} /></div> : <Page key={pageKey} section={section} id={id} />}
      </main>
      {section !== "ask" && <Footer />}
      <TableViewer />
      <CommandPalette />
      <BackToTop />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
