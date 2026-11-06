import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { qc } from "./api";
import App from "./ChatLayout";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/rooms/:room" element={<App />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>,
);
