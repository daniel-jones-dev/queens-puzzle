import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { PlayPage } from "./pages/PlayPage";
import { SolvePage } from "./pages/SolvePage";
import { EditorPage } from "./pages/EditorPage";
import { GeneratorPage } from "./pages/GeneratorPage";
import { RulesPage } from "./pages/RulesPage";
import "./styles/globals.css";

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/play" replace /> },
        { path: "play", element: <PlayPage /> },
        { path: "solve", element: <SolvePage /> },
        { path: "solve/rules", element: <RulesPage /> },
        { path: "editor", element: <EditorPage /> },
        { path: "generator", element: <GeneratorPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
