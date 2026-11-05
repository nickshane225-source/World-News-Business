import { useEffect, useRef } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider, ToastProvider } from "./components/ui.jsx";
import Home from "./pages/public/Home.jsx";
import ArticlePage from "./pages/public/ArticlePage.jsx";
import AboutPage from "./pages/public/AboutPage.jsx";
import Login from "./pages/admin/Login.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import Trending from "./pages/admin/Trending.jsx";
import Articles from "./pages/admin/Articles.jsx";
import ArticleEditor from "./pages/admin/ArticleEditor.jsx";
import Settings from "./pages/admin/Settings.jsx";

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

function getVisitorId() {
  try {
    let vid = localStorage.getItem("wn_vid");
    if (!vid) {
      vid = "v_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem("wn_vid", vid);
    }
    return vid;
  } catch {
    return "";
  }
}

function GoogleAnalyticsTracker() {
  const location = useLocation();
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!location.pathname.startsWith("/admin")) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      fetch("/api/public/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: location.pathname,
          tz,
          visitorId: getVisitorId(),
        }),
      }).catch(() => {});
    }

    if (!GA_MEASUREMENT_ID || !import.meta.env.PROD) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("config", GA_MEASUREMENT_ID, {
        page_path: location.pathname + location.search,
      });
    }
  }, [location.pathname, location.search]);

  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <GoogleAnalyticsTracker />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/a/:slug" element={<ArticlePage />} />
          <Route path="/article/:slug" element={<ArticlePage />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="trending" element={<Trending />} />
            <Route path="articles" element={<Articles />} />
            <Route path="articles/:id" element={<ArticleEditor />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </ToastProvider>
    </ThemeProvider>
  );
}
