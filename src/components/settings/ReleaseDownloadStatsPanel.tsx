import { useCallback, useEffect, useMemo, useState } from "react";

type ReleaseAsset = {
  name: string;
  size: number;
  download_count: number;
  browser_download_url: string;
};

type GitHubRelease = {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
};

type ReleaseRow = {
  tag: string;
  name: string;
  url: string;
  publishedAt: string | null;
  downloads: number;
  assets: Array<{
    name: string;
    label: string;
    downloads: number;
    size: number;
  }>;
};

const RELEASES_URL =
  "https://api.github.com/repos/AbuNizar963/Hadir/releases?per_page=100";
const ARCHITECTURE_LABELS: Record<string, string> = {
  "app-arm64-v8a-release.apk": "ARM64 · الأجهزة الحديثة",
  "app-armeabi-v7a-release.apk": "ARMv7 · الأجهزة القديمة",
  "app-x86_64-release.apk": "x86_64 · المحاكيات",
  "app-release.apk": "Universal · شامل",
  "app-universal-release.apk": "Universal · شامل",
};

function isAndroidAsset(asset: ReleaseAsset) {
  return asset.name.endsWith(".apk");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ar-EG").format(value);
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null) {
  if (!value) return "غير متاح";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير متاح";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeReleases(payload: unknown): ReleaseRow[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .filter((release): release is GitHubRelease => {
      if (!release || typeof release !== "object") return false;
      const candidate = release as Partial<GitHubRelease>;
      return (
        typeof candidate.tag_name === "string" &&
        typeof candidate.name === "string" &&
        Array.isArray(candidate.assets)
      );
    })
    .filter((release) => !release.draft && !release.prerelease)
    .map((release) => {
      const assets = release.assets
        .filter(isAndroidAsset)
        .map((asset) => ({
          name: asset.name,
          label: ARCHITECTURE_LABELS[asset.name] || asset.name,
          downloads: Number.isFinite(asset.download_count)
            ? asset.download_count
            : 0,
          size: Number.isFinite(asset.size) ? asset.size : 0,
        }));

      return {
        tag: release.tag_name,
        name: release.name,
        url: release.html_url,
        publishedAt: release.published_at,
        downloads: assets.reduce((sum, asset) => sum + asset.downloads, 0),
        assets,
      };
    });
}

export default function ReleaseDownloadStatsPanel() {
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (manual = false) => {
    setError("");
    if (manual) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await fetch(RELEASES_URL, {
        headers: {
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "تم تجاوز حد طلبات GitHub مؤقتًا. أعد المحاولة بعد قليل."
            : `تعذر تحميل بيانات الإصدارات (${response.status}).`,
        );
      }

      const data = normalizeReleases(await response.json());
      setReleases(data);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "تعذر تحميل إحصائيات التنزيل حاليًا.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const assets = releases.flatMap((release) => release.assets);
    const architectureDownloads = new Map<string, number>();
    for (const asset of assets) {
      architectureDownloads.set(
        asset.label,
        (architectureDownloads.get(asset.label) || 0) + asset.downloads,
      );
    }

    return {
      totalDownloads: assets.reduce((sum, asset) => sum + asset.downloads, 0),
      totalAssets: assets.length,
      architectureDownloads: [...architectureDownloads.entries()].sort(
        (a, b) => b[1] - a[1],
      ),
    };
  }, [releases]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
        <div>
          <p className="text-sm font-bold">مصدر البيانات: GitHub Releases</p>
          <p className="mt-1 text-xs text-muted-foreground">
            الأرقام تمثل مرات تنزيل ملفات APK المنشورة، وليست عدد الأجهزة الفريدة.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
        >
          <span aria-hidden="true">↻</span>
          {refreshing ? "جارٍ التحديث…" : "تحديث الإحصائيات"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid min-h-48 place-items-center rounded-3xl border border-border/70 bg-card p-8 text-sm text-muted-foreground">
          جارٍ تحميل إحصائيات الإصدارات…
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <p className="text-xs text-muted-foreground">إجمالي التنزيلات</p>
              <p className="mt-2 text-2xl font-black tabular-nums">
                {formatNumber(summary.totalDownloads)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <p className="text-xs text-muted-foreground">الإصدارات المنشورة</p>
              <p className="mt-2 text-2xl font-black tabular-nums">
                {formatNumber(releases.length)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-4">
              <p className="text-xs text-muted-foreground">ملفات APK المتاحة</p>
              <p className="mt-2 text-2xl font-black tabular-nums">
                {formatNumber(summary.totalAssets)}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black">التنزيلات حسب المعمارية</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  مقارنة استخدام النسخ المخصصة والنسخة الشاملة.
                </p>
              </div>
              {lastUpdated && (
                <span className="text-[11px] text-muted-foreground">
                  آخر تحديث: {formatDate(lastUpdated.toISOString())}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {summary.architectureDownloads.length === 0 ? (
                <p className="rounded-2xl bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
                  لا توجد تنزيلات مسجلة بعد.
                </p>
              ) : (
                summary.architectureDownloads.map(([label, downloads]) => {
                  const ratio = summary.totalDownloads
                    ? (downloads / summary.totalDownloads) * 100
                    : 0;
                  return (
                    <div key={label}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold">{label}</span>
                        <span className="mono text-muted-foreground">
                          {formatNumber(downloads)} · {ratio.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.max(ratio, downloads ? 2 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-border/70 bg-card">
            <table className="w-full min-w-[680px] text-right text-sm">
              <thead>
                <tr>
                  <th>الإصدار</th>
                  <th>تاريخ النشر</th>
                  <th>إجمالي التنزيلات</th>
                  <th>المعماريات والملفات</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((release) => (
                  <tr key={release.tag}>
                    <td>
                      <a
                        href={release.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-primary hover:underline"
                      >
                        {release.name || release.tag}
                      </a>
                      <span className="mt-1 block text-[11px] text-muted-foreground mono">
                        {release.tag}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(release.publishedAt)}
                    </td>
                    <td className="font-black tabular-nums">
                      {formatNumber(release.downloads)}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {release.assets.map((asset) => (
                          <span
                            key={asset.name}
                            className="rounded-full border border-border/70 bg-muted/25 px-2 py-1 text-[11px]"
                            title={`${asset.name} · ${formatSize(asset.size)}`}
                          >
                            {asset.label.split(" · ")[0]} · {formatNumber(asset.downloads)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {releases.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-muted-foreground">
                      لا توجد إصدارات منشورة متاحة للعرض.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
