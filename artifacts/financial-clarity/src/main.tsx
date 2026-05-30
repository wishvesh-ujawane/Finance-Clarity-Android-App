import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initCrashReporting } from "@/lib/crash-reporting";

initCrashReporting();

createRoot(document.getElementById("root")!).render(<App />);
