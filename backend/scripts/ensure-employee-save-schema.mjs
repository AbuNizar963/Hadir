import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../src/index.ts", import.meta.url);
let source = readFileSync(file, "utf8");

const anchor = "async function ownerExists(env:Env)";
if (!source.includes("ensureEmployeeSaveSchema")) {
  if (!source.includes(anchor)) throw new Error("Employee save schema guard: anchor not found.");
  const helper = `let employeeSaveSchemaReady:Promise<void>|null=null;\nasync function ensureEmployeeSaveSchema(env:Env){if(!employeeSaveSchemaReady){employeeSaveSchemaReady=(async()=>{const columns=await env.DB.prepare("PRAGMA table_info(employees)").all<any>();const names=new Set((columns.results||[]).map((row:any)=>String(row.name||""));if(!names.has("early_checkout_grace_minutes")){await env.DB.prepare("ALTER TABLE employees ADD COLUMN early_checkout_grace_minutes INTEGER").run();}})().catch(error=>{employeeSaveSchemaReady=null;throw error;});}await employeeSaveSchemaReady;}\n`;
  source = source.replace(anchor, helper + anchor);
}

const callAnchor = "await ensureSchema(env);";
if (!source.includes("await ensureEmployeeSaveSchema(env);")) {
  const count = source.split(callAnchor).length - 1;
  if (count !== 1) throw new Error(`Employee save schema guard: expected one ensureSchema call, found ${count}.`);
  source = source.replace(callAnchor, `${callAnchor}await ensureEmployeeSaveSchema(env);`);
}

writeFileSync(file, source, "utf8");
console.log("Employee save schema guard applied: D1 adds the missing employee early-checkout column before any employee PATCH.");
