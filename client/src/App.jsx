import { Routes, Route } from "react-router-dom";
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

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
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
