import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { currentSession } from "@/lib/auth";
import { employeeAvatarUrl } from "@/lib/avatarUrl";

type Props = { name?: string; jobNumber?: string; avatar?: string | null; compact?: boolean };

export default function EmployeeDigitalCard({ name: nameProp, jobNumber: jobNumberProp, avatar, compact = false }: Props) {
  const session = currentSession();
  const name = nameProp || session?.name || "الموظف";
  const jobNumber = jobNumberProp || session?.jobNumber || "—";
  const employeeId = session?.employeeId || jobNumber;
  const avatarSrc = employeeAvatarUrl(avatar, employeeId);
  const verifyUrl = useMemo(() => `${window.location.origin}/employee/verify/${encodeURIComponent(employeeId)}`, [employeeId]);

  return (
    <section className={`hud-card p-5 ${compact ? "" : "mt-4"}`} aria-label="البطاقة الرقمية للموظف">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div><div className="text-xs text-muted-foreground">الهوية الرقمية</div><h2 className="font-black text-lg">بطاقتي الرقمية</h2></div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary font-black">ID</span>
      </div>
      <div className="rounded-3xl border border-primary/25 bg-primary/5 p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-primary/20 bg-background text-2xl font-black text-primary">
            {avatarSrc ? <img src={avatarSrc} alt={name} className="h-full w-full object-cover" /> : name.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground">Hadir</div>
            <div className="text-xl font-black truncate">{name}</div>
            <div className="text-xs text-muted-foreground mt-1">موظف · الرقم الوظيفي</div>
            <div className="mono text-sm mt-1">{jobNumber}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
          <div className="rounded-xl border bg-background/70 p-3"><div className="text-muted-foreground">الحالة</div><b className="text-primary">● نشط</b></div>
          <div className="rounded-xl border bg-background/70 p-3"><div className="text-muted-foreground">التحقق</div><b>QR آمن</b></div>
        </div>
        <div className="mt-4 rounded-2xl border bg-background p-4 text-center">
          <QRCodeSVG value={verifyUrl} size={150} level="M" className="mx-auto" includeMargin />
          <div className="text-[9px] text-muted-foreground mt-2">امسح الرمز للتحقق من هوية الموظف</div>
        </div>
      </div>
      <button type="button" onClick={() => window.print()} className="btn-primary w-full mt-3 print:hidden">طباعة البطاقة</button>
    </section>
  );
}
