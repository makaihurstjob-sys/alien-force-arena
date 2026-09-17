import { copyFileSync } from "node:fs";
copyFileSync("dist-pages/index.html", "dist-pages/404.html");
