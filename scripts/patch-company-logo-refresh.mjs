import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/components/settings/CompanySpecialtiesPanel.tsx", import.meta.url);
let source = readFileSync(file, "utf8");

const oldBlock = `  async function saveLogo() {
    if (!pendingLogo || saving || !hydrated) return;
    setSaving(true); setMessage(null);
    try {
      await uploadCompanyLogo(pendingLogo);
      const remote = await getBackendSettings();
      applyRemoteSettings(remote);
      setBrandName(remote.brandName || "");
      setBrandLogo(remote.brandLogo || null);
      setPendingLogo(null);
      setMessage("تم حفظ الشعار في R2 وربطه بسجل الهوية في D1.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر حفظ الشعار"); }
    finally { setSaving(false); }
  }`;

const newBlock = `  async function saveLogo() {
    if (!pendingLogo || saving || !hydrated) return;
    setSaving(true); setMessage(null);
    try {
      // The upload response contains the cache-busted URL generated from the
      // new R2 object's ETag. Use it immediately instead of re-reading the
      // possibly stale D1 settings row (especially while D1 is rate-limited).
      const uploadedUrl = await uploadCompanyLogo(pendingLogo);
      setBrandLogo(uploadedUrl);
      setPendingLogo(null);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("hadir:settings-changed"));

      try {
        const remote = await getBackendSettings();
        const refreshed = { ...remote, brandLogo: uploadedUrl } as Settings;
        applyRemoteSettings(refreshed);
        setBrandName(refreshed.brandName || "");
        setBrandLogo(uploadedUrl);
      } catch {
        // R2 upload already succeeded; keep the new URL visible locally even
        // if D1 is temporarily unavailable or still serving an older setting.
      }
      setMessage("تم استبدال الشعار القديم بالشعار الجديد وحفظه في R2.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر حفظ الشعار"); }
    finally { setSaving(false); }
  }`;

const oldRemoveBlock = `  async function removeLogo() {
    if (saving || !hydrated) return;
    setSaving(true); setMessage(null);
    try {
      await deleteCompanyLogo();
      const remote = await getBackendSettings();
      applyRemoteSettings(remote);
      setBrandName(remote.brandName || "");
      setBrandLogo(remote.brandLogo || null);
      setPendingLogo(null);
      setMessage("تم حذف الشعار من R2 وD1.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر إزالة الشعار"); }
    finally { setSaving(false); }
  }`;

const newRemoveBlock = `  async function removeLogo() {
    if (saving || !hydrated) return;
    setSaving(true); setMessage(null);
    try {
      // R2 deletion is authoritative. Clear the UI immediately after the
      // successful DELETE and do not let a stale D1 response restore the old logo.
      await deleteCompanyLogo();
      setBrandLogo(null);
      setPendingLogo(null);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("hadir:settings-changed"));

      try {
        const remote = await getBackendSettings();
        const refreshed = { ...remote, brandLogo: null } as Settings;
        applyRemoteSettings(refreshed);
        setBrandName(refreshed.brandName || "");
        setBrandLogo(null);
      } catch {
        // R2 deletion already succeeded; keep the logo removed locally even
        // if D1 is temporarily unavailable or still serving an older setting.
      }
      setMessage("تم حذف الشعار نهائيًا من R2 وتحديث الواجهة.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "تعذر إزالة الشعار"); }
    finally { setSaving(false); }
  }`;

if (source.includes(newBlock) && source.includes(newRemoveBlock)) {
  console.log("Company logo refresh patch: upload and removal behavior already applied.");
  process.exit(0);
}
if (source.includes(oldBlock)) source = source.replace(oldBlock, newBlock);
if (source.includes(oldRemoveBlock)) source = source.replace(oldRemoveBlock, newRemoveBlock);

if (!source.includes(newBlock)) {
  throw new Error("Company logo refresh patch: saveLogo anchor not found; refusing unsafe replacement.");
}
if (!source.includes(newRemoveBlock)) {
  throw new Error("Company logo refresh patch: removeLogo anchor not found; refusing unsafe replacement.");
}

writeFileSync(file, source, "utf8");
console.log("Company logo refresh patch: new R2 logo is applied immediately and removal clears the UI without allowing stale D1 data to restore it.");
