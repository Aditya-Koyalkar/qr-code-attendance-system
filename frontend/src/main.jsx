import { ClerkProvider } from "@clerk/clerk-react";
import { createRoot } from "react-dom/client";
import "./index.css";

import App from "./App.jsx";
const PUBLISHABLE_KEY = import.meta.env.VITE_PUBLISHABLE_KEY;

createRoot(document.getElementById("root")).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <App />
  </ClerkProvider>
);
