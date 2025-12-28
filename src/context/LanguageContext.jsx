import React, { createContext, useContext, useEffect, useState } from "react";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState("SW"); // "SW" | "EN"

  // Load saved language once
  useEffect(() => {
    const saved = localStorage.getItem("swahiba_lang");
    if (saved === "SW" || saved === "EN") setLang(saved);
  }, []);

  // Persist changes
  useEffect(() => {
    localStorage.setItem("swahiba_lang", lang);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside <LanguageProvider />");
  return ctx;
}