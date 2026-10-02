import { createRoot } from "react-dom/client";
import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { Home } from "../src/routes/index";
import { Practice } from "../src/routes/practice";
import { Arcade } from "../src/routes/arcade";
import Classic from "../src/components/Classic";
import BulletRun from "../src/components/BulletRun";
import "../src/styles.css";

const root = createRootRoute({ component: Outlet });
const home = createRoute({ getParentRoute: () => root, path: "/", component: Home });
const classic = createRoute({ getParentRoute: () => root, path: "/classic", component: () => <Classic menuHref={import.meta.env.BASE_URL} /> });
const practice = createRoute({ getParentRoute: () => root, path: "/practice", component: Practice });
const bulletRun = createRoute({ getParentRoute: () => root, path: "/bullet-run", component: BulletRun });
const arcade = createRoute({ getParentRoute: () => root, path: "/arcade", component: Arcade });
const router = createRouter({ routeTree: root.addChildren([home, classic, practice, bulletRun, arcade]), basepath: import.meta.env.BASE_URL });
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
