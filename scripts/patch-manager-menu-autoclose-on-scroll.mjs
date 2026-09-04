import { readFileSync, writeFileSync } from "node:fs";

const targets = [
  {
    path: new URL("../src/components/layout/ManagerLayout.tsx", import.meta.url),
    stateAnchor: '  const [themeMenuOpen, setThemeMenuOpen] = useState(false);',
    effect: `  useEffect(() => {\n    let lastScrollY = window.scrollY;\n    const onScroll = () => {\n      const currentScrollY = window.scrollY;\n      if (menuOpen && currentScrollY > lastScrollY + 2) {\n        setMenuOpen(false);\n        setThemeMenuOpen(false);\n      }\n      lastScrollY = currentScrollY;\n    };\n    window.addEventListener("scroll", onScroll, { passive: true });\n    return () => window.removeEventListener("scroll", onScroll);\n  }, [menuOpen]);\n`,
  },
  {
    path: new URL("../src/components/layout/EmployeeLayout.tsx", import.meta.url),
    stateAnchor: '  const [themeMenuOpen, setThemeMenuOpen] = useState(false);',
    effect: `  useEffect(() => {\n    let lastScrollY = window.scrollY;\n    const onScroll = () => {\n      const currentScrollY = window.scrollY;\n      if (menuOpen && currentScrollY > lastScrollY + 2) {\n        setMenuOpen(false);\n        setThemeMenuOpen(false);\n      }\n      lastScrollY = currentScrollY;\n    };\n    window.addEventListener("scroll", onScroll, { passive: true });\n    return () => window.removeEventListener("scroll", onScroll);\n  }, [menuOpen]);\n`,
  },
];

for (const target of targets) {
  let source = readFileSync(target.path, "utf8");
  if (source.includes("lastScrollY = window.scrollY")) {
    console.log(`menu auto-close already present: ${target.path.pathname}`);
    continue;
  }
  if (!source.includes(target.stateAnchor)) {
    throw new Error(`Menu auto-close patch anchor not found in ${target.path.pathname}; refusing unsafe replacement.`);
  }
  source = source.replace(target.stateAnchor, `${target.stateAnchor}\n${target.effect}`);
  writeFileSync(target.path, source, "utf8");
  console.log(`menu auto-close added: ${target.path.pathname}`);
}
