import React from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "../bitcoin-retirement-calculator.jsx";

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <Analytics />
  </>
);
