import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/pages/ManagerReports.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

// This build-time guard keeps the source patch deterministic and idempotent.
if (!source.includes("type AttendanceBucket =")) {
  const oldType = 'type Audit = { id?: string | number; employeeId?: string; action?: string; result?: string; timestamp?: string; jobNumber?: string; actorName?: string; employeeName?: string };';
  const newType = `${oldType}\ntype AttendanceBucket = { in?: Audit; out?: Audit; events?: Audit[] };`;
  if (!source.includes(oldType)) throw new Error("ManagerReports: Audit type anchor not found.");
  source = source.replace(oldType, newType);

  const oldAudit = `function auditIndex(a: Audit[]) {
  const m = new Map<string, { in?: Audit; out?: Audit }>();
  for (const x of a) {
    if (x.result !== "success" || !x.employeeId || !x.timestamp || (x.action !== "check-in" && x.action !== "check-out")) continue;
    const k = \`${"${x.employeeId}"}|\${"${key(x.timestamp)}"}\`, c = m.get(k) || {};
    if (x.action === "check-in" && (!c.in || new Date(x.timestamp) < new Date(c.in.timestamp!))) c.in = x;
    if (x.action === "check-out" && (!c.out || new Date(x.timestamp) > new Date(c.out.timestamp!))) c.out = x;
    m.set(k, c);
  }
  return m;
}`;
  const newAudit = `function auditIndex(a: Audit[]) {
  const m = new Map<string, AttendanceBucket>();
  for (const x of a) {
    if (x.result !== "success" || !x.employeeId || !x.timestamp || (x.action !== "check-in" && x.action !== "check-out")) continue;
    const dayKey = \`${"${x.employeeId}"}|\${"${key(x.timestamp)}"}\`;
    const day = m.get(dayKey) || {};
    if (x.action === "check-in" && (!day.in || new Date(x.timestamp) < new Date(day.in.timestamp!))) day.in = x;
    if (x.action === "check-out" && (!day.out || new Date(x.timestamp) > new Date(day.out.timestamp!))) day.out = x;
    m.set(dayKey, day);
    const eventKey = \`${"${x.employeeId}"}|__events__\`;
    const eventsBucket = m.get(eventKey) || {};
    eventsBucket.events = eventsBucket.events || [];
    eventsBucket.events.push(x);
    m.set(eventKey, eventsBucket);
  }
  for (const bucket of m.values()) if (bucket.events) bucket.events.sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());
  return m;
}`;
  if (!source.includes(oldAudit)) throw new Error("ManagerReports: auditIndex anchor not found.");
  source = source.replace(oldAudit, newAudit);

  source = source.replace(
    'index: Map<string, { in?: Audit; out?: Audit }>',
    'index: Map<string, AttendanceBucket>',
  );

  const oldDetailAttendance = `    const s = index.get(\`${"${employee.id}"}|\${"${k}"}\`), dailyRow = dailyStatus?.get(employee.id), serverStatus = dailyStatusFor(dailyRow), grace = employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
    const cinValue = s?.in?.timestamp || dailyRow?.checkInAt || null, coutValue = s?.out?.timestamp || dailyRow?.checkOutAt || null;
    const cin = cinValue ? new Date(cinValue) : null, cout = coutValue ? new Date(coutValue) : null;`;
  const newDetailAttendance = `    const dayBucket = index.get(\`${"${employee.id}"}|\${"${k}"}\`) || {};
    const events = index.get(\`${"${employee.id}"}|__events__\`)?.events || [];
    const rotation = employee.scheduleType === "ROTATION" && w.kind === "ROTATION" && !!w.start && !!w.end;
    const rotationCheckIn = rotation ? [...events].reverse().find(x => x.action === "check-in" && new Date(x.timestamp!).getTime() >= w.start!.getTime() && new Date(x.timestamp!).getTime() < w.end!.getTime() && new Date(x.timestamp!).getTime() <= new Date(d.getTime() + 86_400_000).getTime()) : undefined;
    const rotationCheckOut = rotation && rotationCheckIn ? events.find(x => x.action === "check-out" && new Date(x.timestamp!).getTime() > new Date(rotationCheckIn.timestamp!).getTime() && new Date(x.timestamp!).getTime() <= w.end!.getTime()) : undefined;
    const dailyRow = dailyStatus?.get(employee.id), serverStatus = dailyStatusFor(dailyRow), grace = employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
    const cinValue = (rotation ? rotationCheckIn?.timestamp : dayBucket.in?.timestamp) || dailyRow?.checkInAt || null;
    const coutValue = (rotation ? rotationCheckOut?.timestamp : dayBucket.out?.timestamp) || dailyRow?.checkOutAt || null;
    const cin = cinValue ? new Date(cinValue) : null, cout = coutValue ? new Date(coutValue) : null;`;
  if (!source.includes(oldDetailAttendance)) throw new Error("ManagerReports: detail attendance anchor not found.");
  source = source.replace(oldDetailAttendance, newDetailAttendance);

  const oldSummaryAttendance = `    const s = index.get(\`${"${employee.id}"}|\${"${k}"}\`), dailyRow = dailyStatus?.get(employee.id), serverStatus = dailyStatusFor(dailyRow), grace = employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
    const cinValue = s?.in?.timestamp || dailyRow?.checkInAt || null, coutValue = s?.out?.timestamp || dailyRow?.checkOutAt || null;
    const cin = cinValue ? new Date(cinValue) : null, cout = coutValue ? new Date(coutValue) : null;`;
  const newSummaryAttendance = `    const dayBucket = index.get(\`${"${employee.id}"}|\${"${k}"}\`) || {};
    const events = index.get(\`${"${employee.id}"}|__events__\`)?.events || [];
    const rotation = employee.scheduleType === "ROTATION" && w.kind === "ROTATION" && !!w.start && !!w.end;
    const rotationCheckIn = rotation ? [...events].reverse().find(x => x.action === "check-in" && new Date(x.timestamp!).getTime() >= w.start!.getTime() && new Date(x.timestamp!).getTime() < w.end!.getTime() && new Date(x.timestamp!).getTime() <= new Date(d.getTime() + 86_400_000).getTime()) : undefined;
    const rotationCheckOut = rotation && rotationCheckIn ? events.find(x => x.action === "check-out" && new Date(x.timestamp!).getTime() > new Date(rotationCheckIn.timestamp!).getTime() && new Date(x.timestamp!).getTime() <= w.end!.getTime()) : undefined;
    const dailyRow = dailyStatus?.get(employee.id), serverStatus = dailyStatusFor(dailyRow), grace = employee.gracePeriodMinutes ?? settings.lateGraceMinutes ?? 10;
    const cinValue = (rotation ? rotationCheckIn?.timestamp : dayBucket.in?.timestamp) || dailyRow?.checkInAt || null;
    const coutValue = (rotation ? rotationCheckOut?.timestamp : dayBucket.out?.timestamp) || dailyRow?.checkOutAt || null;
    const cin = cinValue ? new Date(cinValue) : null, cout = coutValue ? new Date(coutValue) : null;
    const rotationCheckInDay = rotation && rotationCheckIn ? key(rotationCheckIn.timestamp!) === k : false;
    const rotationCheckOutDay = rotation && rotationCheckOut ? key(rotationCheckOut.timestamp!) === k : false;`;
  if (!source.includes(oldSummaryAttendance)) throw new Error("ManagerReports: summary attendance anchor not found.");
  source = source.replace(oldSummaryAttendance, newSummaryAttendance);

  // Rotation attendance is a single continuous work period. An active check-in is
  // therefore PRESENT on every work date until the scheduled rotation end, while
  // late/early minutes and worked duration are counted only once per real event.
  source = source.replace(
    '      else st = "open";\n    }\n    if (dailyStatus && serverStatus) st = serverStatus === "late" && !cout ? "open" : serverStatus;',
    '      else st = rotation && w.end && new Date() < w.end ? (lm && rotationCheckInDay ? "late" : "present") : "open";\n    }\n    if (dailyStatus && serverStatus && !rotation) st = serverStatus === "late" && !cout ? "open" : serverStatus;'
  );

  source = source.replace(
    '    if (serverStatus === "not_started") continue;\n    if (serverStatus === "off") { off++; continue; }\n    if (serverStatus === "leave") { leave++; continue; }\n    if (serverStatus === "permission") { permission++; continue; }\n    if (serverStatus === "absent") { absent++; continue; }\n    if (!cin) { absent++; continue; }\n    const lm = w.start ? Math.max(0, Math.round((cin.getTime() - w.start.getTime()) / 60000) - grace) : 0; lateMinutes += lm;\n    if (!cout) { open++; continue; }\n    const wd = Math.max(0, minutesBetween(cin.toISOString(), cout.toISOString())); worked += wd;\n    const em = w.end ? Math.max(0, Math.round((w.end.getTime() - cout.getTime()) / 60000)) : 0; earlyMinutes += em;\n    if (serverStatus === "late") late++; else if (serverStatus === "early" || em) early++; else if (serverStatus === "present") present++; else if (em) early++; else if (lm) late++; else present++;',
    '    if (!rotation && serverStatus === "not_started") continue;\n    if (!rotation && serverStatus === "off") { off++; continue; }\n    if (!rotation && serverStatus === "leave") { leave++; continue; }\n    if (!rotation && serverStatus === "permission") { permission++; continue; }\n    if (!rotation && serverStatus === "absent") { absent++; continue; }\n    if (!cin) { absent++; continue; }\n    const lm = w.start ? Math.max(0, Math.round((cin.getTime() - w.start.getTime()) / 60000) - grace) : 0;\n    if (!rotation || rotationCheckInDay) lateMinutes += lm;\n    if (!cout) {\n      if (rotation && w.end && new Date() < w.end) { if (rotationCheckInDay && lm) late++; else present++; }\n      else open++;\n      continue;\n    }\n    const wd = Math.max(0, minutesBetween(cin.toISOString(), cout.toISOString()));\n    if (!rotation || rotationCheckOutDay) worked += wd;\n    const em = w.end ? Math.max(0, Math.round((w.end.getTime() - cout.getTime()) / 60000)) : 0;\n    if (!rotation || rotationCheckOutDay) earlyMinutes += em;\n    if (rotation) {\n      if (rotationCheckInDay && lm) late++;\n      else if (rotationCheckOutDay && em) early++;\n      else present++;\n    } else if (serverStatus === "late") late++; else if (serverStatus === "early" || em) early++; else if (serverStatus === "present") present++; else if (em) early++; else if (lm) late++; else present++;'
  );

  // Do not let the daily server snapshot overwrite the rotation calculation.
  source = source.replace(
    '    if (dailyStatus && serverStatus) st = serverStatus === "late" && !cout ? "open" : serverStatus;',
    '    if (dailyStatus && serverStatus && !rotation) st = serverStatus === "late" && !cout ? "open" : serverStatus;'
  );

  // For an active rotation, show elapsed work in the expanded daily detail without
  // inventing a checkout event. Historical completed rotations use the real checkout.
  source = source.replace(
    '    detail.push({ date: k, day: days[d.getDay()], status: st, checkIn: cin ? formatTime(cin.toISOString()) : "—", checkOut: cout ? formatTime(cout.toISOString()) : "—", worked: wd, late: lm, early: em, detail: [w.detail || "يوم عمل", requestText(requests, employee.id, k)].filter(Boolean).join(" · ") });',
    '    if (rotation && cin && !cout && w.end) { const elapsedEnd = new Date(Math.min(Date.now(), w.end.getTime())); wd = Math.max(0, minutesBetween(cin.toISOString(), elapsedEnd.toISOString())); }\n    detail.push({ date: k, day: days[d.getDay()], status: st, checkIn: cin ? formatTime(cin.toISOString()) : "—", checkOut: cout ? formatTime(cout.toISOString()) : "—", worked: wd, late: lm, early: em, detail: [w.detail || "يوم عمل", rotation && !cout ? "مناوبة مستمرة — الانصراف في نهاية المناوبة" : "", requestText(requests, employee.id, k)].filter(Boolean).join(" · ") });'
  );

  // Printing: let a group/table flow naturally to the next A4 page instead of
  // reserving a whole page for a group that happens to be slightly too tall.
  source = source.replace('className="border-2 border-black/70 overflow-hidden bg-white print:break-inside-avoid print:w-full"', 'className="border-2 border-black/70 overflow-hidden bg-white print:break-inside-auto print:w-full"');
  source = source.replace('className="p-2 border-l border-black/20 text-center font-bold">{i + 1}</td>', 'className="p-2 border-l border-black/20 text-center font-bold">{i + 1}</td>');
  source = source.replace('.service-report > div:nth-child(2) > .grid > div { width: 100% !important; margin: 0 0 3mm !important; break-inside: avoid !important; page-break-inside: avoid !important; }', '.service-report > div:nth-child(2) > .grid > div { width: 100% !important; margin: 0 0 3mm !important; break-inside: auto !important; page-break-inside: auto !important; }');

  writeFileSync(file, source, "utf8");
}

console.log("ManagerReports build patch: rotation logic + print pagination ready.");
