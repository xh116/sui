import { useEffect, useState } from "react";

// The active theme lives on <html data-theme="..."> and is written by the
// sidebar. Charts draw on <canvas>, where Tailwind classes can't reach, so
// they read the attribute and re-render when it changes.
function readTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export default function useTheme() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
