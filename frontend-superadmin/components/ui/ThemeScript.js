import React from "react";

const STORAGE_KEY = "pet_protocols_superadmin_theme";
const SHARED_KEY = "pet_protocols_theme";

/**
 * Server Component: Inlines the theme initialization script directly into the HTML head
 * before paint to eliminate FOUC, without triggering React 19 client script warnings.
 */
export function ThemeScript() {
  const scriptContent = `
(function() {
  try {
    function getCookie(name) {
      var v = "; " + document.cookie;
      var parts = v.split("; " + name + "=");
      if (parts.length === 2) return decodeURIComponent(parts.pop().split(";").shift());
      return null;
    }
    var theme = getCookie("${STORAGE_KEY}") ||
                getCookie("${SHARED_KEY}") ||
                localStorage.getItem("${STORAGE_KEY}") ||
                localStorage.getItem("${SHARED_KEY}") ||
                "dark";
    if (theme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  } catch (e) {}
})();
  `;

  return (
    <script
      id="superadmin-theme-initializer"
      dangerouslySetInnerHTML={{ __html: scriptContent }}
    />
  );
}

export default ThemeScript;
