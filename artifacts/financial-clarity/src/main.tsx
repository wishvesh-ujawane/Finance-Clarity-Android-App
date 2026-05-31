import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initGoogleAuth } from "./lib/googleAuth";

// Best-effort: fire and forget. Components await initGoogleAuth() again before use.
void initGoogleAuth().catch(() => { /* ignore; surfaced when sign-in is attempted */ });

createRoot(document.getElementById("root")!).render(<App />);
