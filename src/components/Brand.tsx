import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getSettings } from "@/lib/storage";

export default function Brand({ className }: { className?: string }) {
  const [name, setName] = useState<string>(
    () => getSettings().brandName || "حاضِر"
  );

  useEffect(() => {
    const sync = () => {
      const s = getSettings();
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
        <img
          src={`${import.meta.env.BASE_URL}favicon.svg`}
          alt="شعار تطبيق حاضر"
          className="h-9 w-9 rounded-xl object-cover border border-primary/30"
        />
        <div className="leading-tight">
          <div className="text-lg font-extrabold tracking-tight">{name}</div>
          <div className="text-[10px] text-muted-foreground mono">HADIR · v1.1</div>
        </div>
      </div>
    </div>
  );
}
