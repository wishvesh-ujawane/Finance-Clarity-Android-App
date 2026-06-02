import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initGoogleAuth } from "./lib/googleAuth";
import { initCrashlytics } from "./lib/crashlytics";

// Initialize Firebase Crashlytics as early as possible so we capture any
// startup errors. No-op on web; native-only.
void initCrashlytics();

// Best-effort: fire and forget. Components await initGoogleAuth() again before use.
void initGoogleAuth().catch(() => { /* ignore; surfaced when sign-in is attempted */ });

createRoot(document.getElementById("root")!).render(<App />);
