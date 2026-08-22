import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getSettings } from "@/lib/storage";

export default function Brand({ className }: { className?: string }) {
  const [logo, setLogo] = useState<string | null | undefined>(
    () => getSettings().brandLogo
  );
  const [name, setName] = useState<string>(
    () => getSettings().brandName || "حاضِر"
  );

  useEffect(() => {
    const sync = () => {
      const s = getSettings();
      setLogo(s.brandLogo);
      setName(s.brandName || "حاضِر");
    };
    window.addEventListener("hadir:settings-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("hadir:settings-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return (
    <div className={cn("flex items-center w-full", className)}>
      <div className="flex items-center gap-2.5">
        {logo ? (
          <img
            src={logo}
            alt={name}
            className="h-9 w-9 rounded-xl object-cover border border-primary/30"
          />
        ) : (
          <div className="relative h-9 w-9 rounded-xl bg-primary/15 grid place-items-center signal-ring">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v3" />
              <path d="M12 19v3" />
              <path d="M4.9 4.9l2.1 2.1" />
              <path d="M17 17l2.1 2.1" />
              <path d="M2 12h3" />
              <path d="M19 12h3" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </div>
        )}
        <div className="leading-tight">
          <div className="text-lg font-extrabold tracking-tight">{name}</div>
          <div className="text-[10px] text-muted-foreground mono">HADIR · v1.1</div>
        </div>
      </div>
    </div>
  );
}
