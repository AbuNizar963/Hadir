import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { backendEnabled, createBackendEmployee, getBackendEmployees, getBackendLocations } from "@/lib/backend";
import { getEmployees, saveEmployees } from "@/lib/storage";
import { generateId } from "@/lib/utils";
import { hash } from "@/lib/hash";
import type { Employee } from "@/types";

type Row = Record<string, unknown>;
type Mapping = { name: string; jobNumber: string };

const normalize = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/[\s_\-./\\()\[\]{}:]+/g, "");
const text = (v: unknown) => String(v ?? "").trim();
const isLikelyName = (v: unknown) => { const s = text(v); return s.length >= 3 && s.length <= 90 && !/^\d+$/.test(s) && /[A-Za-z\u0600-\u06FF]/.test(s); };
const isLikelyJob = (v: unknown) => { const s = text(v); return s.length >= 2 && s.length <= 30 && /^[A-Za-z0-9٠-٩\-_/]+$/.test(s) && /\d/.test(s); };
const aliases = {
  name: ["name","fullname","full_name","employee_name","employeename","اسم","اسم الموظف","الاسم","الاسم الكامل"],
  job: ["jobnumber","job_number","employeenumber","employee_number","employeeid","employee_id","id","number","رقم","الرقم الوظيفي","الرقم الوظيفى","رقم الموظف","الرقم"]
};
function scoreHeader(value: unknown, words: string[]) { const n = normalize(value); return words.some(w => normalize(w) === n) ? 100 : words.some(w => n.includes(normalize(w))) ? 60 : 0; }
function detectMapping(rows: Row[]): Mapping {
  if (!rows.length) throw new Error("الملف لا يحتوي على بيانات.");
  const keys = Object.keys(rows[0]);
  let name = keys.map(k => [scoreHeader(k, aliases.name), k] as const).sort((a,b)=>b[0]-a[0])[0]?.[1];
  let jobNumber = keys.map(k => [scoreHeader(k, aliases.job), k] as const).sort((a,b)=>b[0]-a[0])[0]?.[1];
  if (name && jobNumber && name !== jobNumber) return { name, jobNumber };
  const sample = rows.slice(0, Math.min(100, rows.length));
  const candidates = keys.map(k => {
    const vals = sample.map(r => text(r[k])).filter(Boolean);
    const unique = new Set(vals).size;
    const numeric = vals.filter(isLikelyJob).length / Math.max(vals.length,1);
    const names = vals.filter(isLikelyName).length / Math.max(vals.length,1);
    return { k, numeric, names, uniqueRatio: unique / Math.max(vals.length,1), avg: vals.reduce((n,v)=>n+v.length,0)/Math.max(vals.length,1) };
  });
  if (!name) name = [...candidates].sort((a,b)=>(b.names*70+b.uniqueRatio*10+b.avg)-(a.names*70+a.uniqueRatio*10+a.avg))[0]?.k;
  if (!jobNumber) jobNumber = [...candidates].filter(c=>c.k!==name).sort((a,b)=>(b.numeric*80+b.uniqueRatio*20)-(a.numeric*80+a.uniqueRatio*20))[0]?.k;
  if (!name || !jobNumber || name === jobNumber) throw new Error("تعذر تحديد عمود الاسم والرقم الوظيفي تلقائيًا. اخترهما يدويًا.");
  return { name, jobNumber };
}

export default function SmartEmployeeImport({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array", cellDates: false });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("لم يتم العثور على ورقة بيانات.");
      const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false });
      const mapping = detectMapping(rows);
      const existing = backendEnabled ? await getBackendEmployees() : getEmployees();
      const jobs = new Set(existing.map(e => text(e.jobNumber).toLowerCase()));
      const locations = backendEnabled ? await getBackendLocations() : [];
      const defaultLocation = locations.find(l => l.id === "main")?.id || locations[0]?.id || "main";
      let added = 0, skipped = 0, invalid = 0;
      for (const row of rows) {
        const name = text(row[mapping.name]);
        const jobNumber = text(row[mapping.jobNumber]);
        if (!name || !jobNumber) { invalid++; continue; }
        const key = jobNumber.toLowerCase();
        if (jobs.has(key)) { skipped++; continue; }
        const common = { name, jobNumber, status: "active" as const, deviceId: null, deviceLabel: null, scheduleType: "ADMIN" as const, workStartTime: "08:00", workEndTime: "16:00", gracePeriodMinutes: 15, rotationStartDate: null, workDays: [0,1,2,3,4], avatar: null, role: "staff" as const, locationId: defaultLocation, specialties: ["general"] };
        if (backendEnabled) await createBackendEmployee({ ...common, pin: jobNumber });
        else {
          const emp: Employee = { id: generateId(), pinHash: hash(jobNumber), createdAt: new Date().toISOString(), ...common };
          const all = [emp, ...getEmployees()]; saveEmployees(all, { [emp.id]: jobNumber });
        }
        jobs.add(key); added++;
      }
      setMessage(`تم التعرف على الأعمدة: الاسم «${mapping.name}» والرقم الوظيفي «${mapping.jobNumber}». تمت إضافة ${added} موظف، وتخطي ${skipped} مكرر، وتجاهل ${invalid} صف غير صالح.`);
      onImported?.();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر استيراد الملف."); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  return <div className="space-y-2">
    <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" className="hidden" onChange={e => void handleFile(e.target.files?.[0])} />
    <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}><FileSpreadsheet className="ml-2 h-4 w-4" />{busy ? "جاري تحليل الملف…" : "استيراد Excel / CSV ذكي"}<Wand2 className="mr-2 h-4 w-4" /></Button>
    {message && <div className="text-sm text-emerald-600">{message}</div>}
    {error && <div className="text-sm text-destructive">{error}</div>}
  </div>;
}