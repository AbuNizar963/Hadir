import {
  archiveClosedMonth,
  previousMonthPeriod,
} from "./report-archive";
import { materializeDay } from "./professional-attendance-fact-builder";
import {
  DEFAULT_SYSTEM_TIME_ZONE,
  getConfiguredSystemTimeZone,
} from "./system-timezone";

type Env = {
  DB: D1Database;
  REPORT_ARCHIVES?: R2Bucket;
  APP_TIMEZONE?: string;
};

type ArchiveJob = {
  job_id: string;
  report_id: string;
  period_from: string;
  period_to: string;
  day_cursor: number;
  employee_cursor: number;
  status: string;
  attempts: number;
  error_message: string | null;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  lease_until: string | null;
};

const LEASE_MINUTES = 10;
const MAX_EMPLOYEE_DAYS_PER_RUN = 24;

function jobId(periodFrom: string) {
  return `attendance_period_${periodFrom}`;
}

function periodDay(period: ArchiveJob, cursor: number) {
  const [year, month] = period.period_from.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, cursor + 1))
    .toISOString()
    .slice(0, 10);
}

async function currentClosedPeriod(env: Env, now = new Date()) {
  const timezone = await getConfiguredSystemTimeZone(
    env.DB,
    env.APP_TIMEZONE || DEFAULT_SYSTEM_TIME_ZONE,
  );
  return previousMonthPeriod(now, timezone);
}

export async function getArchiveJob(env: Env) {
  const period = await currentClosedPeriod(env);
  return env.DB.prepare(
    "SELECT * FROM report_archive_jobs WHERE job_id=? LIMIT 1",
  )
    .bind(jobId(period.from))
    .first<ArchiveJob>();
}

export async function startArchiveJob(env: Env, now = new Date()) {
  const period = await currentClosedPeriod(env, now);
  const id = jobId(period.from);
  const timestamp = now.toISOString();
  await env.DB.prepare(
    `INSERT INTO report_archive_jobs
      (job_id,report_id,period_from,period_to,requested_at,updated_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(job_id) DO UPDATE SET
       status=CASE WHEN report_archive_jobs.status IN ('FAILED','CANCELLED') THEN 'QUEUED' ELSE report_archive_jobs.status END,
       error_message=NULL,
       requested_at=excluded.requested_at,
       updated_at=excluded.updated_at`,
  )
    .bind(id, id, period.from, period.to, timestamp, timestamp)
    .run();

  const job = await env.DB.prepare(
    "SELECT * FROM report_archive_jobs WHERE job_id=? LIMIT 1",
  )
    .bind(id)
    .first<ArchiveJob>();
  return { ok: true, queued: job?.status !== "COMPLETED", job };
}

async function claimJob(env: Env, now: Date) {
  const period = await currentClosedPeriod(env, now);
  const id = jobId(period.from);
  const leaseUntil = new Date(
    now.getTime() + LEASE_MINUTES * 60 * 1000,
  ).toISOString();
  const result = await env.DB.prepare(
    `UPDATE report_archive_jobs
     SET status='RUNNING', started_at=COALESCE(started_at,?),
         updated_at=?, lease_until=?
     WHERE job_id=?
       AND status IN ('QUEUED','RUNNING')
       AND (lease_until IS NULL OR lease_until<?)`,
  )
    .bind(now.toISOString(), now.toISOString(), leaseUntil, id, now.toISOString())
    .run();
  if (!Number(result.meta?.changes || 0)) return null;
  return env.DB.prepare(
    "SELECT * FROM report_archive_jobs WHERE job_id=? LIMIT 1",
  )
    .bind(id)
    .first<ArchiveJob>();
}

async function saveProgress(env: Env, job: ArchiveJob) {
  await env.DB.prepare(
    `UPDATE report_archive_jobs
     SET day_cursor=?, employee_cursor=?, updated_at=?, lease_until=?
     WHERE job_id=?`,
  )
    .bind(
      job.day_cursor,
      job.employee_cursor,
      new Date().toISOString(),
      new Date(Date.now() + LEASE_MINUTES * 60 * 1000).toISOString(),
      job.job_id,
    )
    .run();
}

export async function processArchiveJob(env: Env, now = new Date()) {
  if (!env.REPORT_ARCHIVES) throw new Error("R2 binding REPORT_ARCHIVES غير موجود");
  const job = await claimJob(env, now);
  if (!job) return { ok: true, processed: false, reason: "no_job" };

  try {
    let processed = 0;
    while (processed < MAX_EMPLOYEE_DAYS_PER_RUN) {
      const day = periodDay(job, job.day_cursor);
      if (day > job.period_to) {
        const result = await archiveClosedMonth(env, now, true);
        const completedAt = new Date().toISOString();
        await env.DB.prepare(
          `UPDATE report_archive_jobs
           SET status='COMPLETED',completed_at=?,updated_at=?,lease_until=NULL,error_message=NULL
           WHERE job_id=?`,
        )
          .bind(completedAt, completedAt, job.job_id)
          .run();
        return { ...result, jobId: job.job_id, status: "COMPLETED" };
      }

      const employee = await env.DB.prepare(
        "SELECT id FROM employees ORDER BY id LIMIT 1 OFFSET ?",
      )
        .bind(job.employee_cursor)
        .first<{ id: string }>();
      if (!employee) {
        job.day_cursor += 1;
        job.employee_cursor = 0;
        await saveProgress(env, job);
        continue;
      }

      await materializeDay(
        env,
        day,
        { id: "system-archive", role: "owner" },
        String(employee.id),
        env.APP_TIMEZONE || DEFAULT_SYSTEM_TIME_ZONE,
      );
      job.employee_cursor += 1;
      processed += 1;
      await saveProgress(env, job);
    }

    return {
      ok: true,
      processed: true,
      status: "RUNNING",
      jobId: job.job_id,
      day: periodDay(job, job.day_cursor),
      dayCursor: job.day_cursor,
      employeeCursor: job.employee_cursor,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تنفيذ أرشيف التقارير";
    const timestamp = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE report_archive_jobs
       SET status='QUEUED',attempts=attempts+1,error_message=?,updated_at=?,lease_until=NULL
       WHERE job_id=?`,
    )
      .bind(message, timestamp, job.job_id)
      .run()
      .catch(() => undefined);
    console.error("[report-archive-job] background run failed", message);
    return { ok: false, status: "QUEUED", jobId: job.job_id, error: message };
  }
}
