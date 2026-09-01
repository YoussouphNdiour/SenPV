"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  FolderKanban,
  Zap,
  PiggyBank,
  Users,
  TrendingUp,
  Activity,
  Plus,
  Sun,
  Shield,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/dashboard/KPICard";
import { PipelineBoard } from "@/components/dashboard/PipelineBoard";
import { RecentProjectsTable } from "@/components/dashboard/RecentProjectsTable";
import { useDashboardStore } from "@/store/dashboard";
import type {
  AdminStats,
  ChartData,
  InstallerStats,
  MonthCount,
  ParticularStats,
  PipelineData,
  RecentProject,
} from "@/types/dashboard";

const MONTH_KEYS_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

const MONTH_KEYS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatMonthData(data: MonthCount[], locale: string) {
  const names = locale === "en" ? MONTH_KEYS_EN : MONTH_KEYS_FR;
  return data.map((d) => ({
    name: names[d.month - 1] ?? `M${d.month}`,
    count: d.count,
  }));
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tp = useTranslations("project");
  const { data: session } = useSession();
  const {
    stats,
    recentProjects,
    pipeline,
    chartData,
    loading,
    fetchStats,
    fetchRecentProjects,
    fetchPipeline,
    fetchChartData,
  } = useDashboardStore();

  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const userName = session?.user?.name || "";
  const companyName = (session?.user as { company_name?: string } | undefined)
    ?.company_name;
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const locale = (session?.user as { locale?: string } | undefined)?.locale || "fr";

  useEffect(() => {
    if (!token) return;
    fetchStats(token);
    fetchRecentProjects(token);
    fetchChartData(token);
    if (userRole === "installer" || userRole === "admin") {
      fetchPipeline(token);
    }
  }, [token, userRole, fetchStats, fetchRecentProjects, fetchPipeline, fetchChartData]);

  const refreshPipeline = () => {
    if (token) {
      fetchPipeline(token);
      fetchStats(token);
    }
  };

  if (loading && !stats) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {t("welcome", { name: userName })}
          </h1>
          {userRole === "installer" && companyName && (
            <p className="text-muted-foreground">{companyName}</p>
          )}
        </div>
        <Link href="/projects">
          <Button>
            <Plus className="size-4 mr-2" />
            {t("newProject")}
          </Button>
        </Link>
      </div>

      {/* Role-based content */}
      {userRole === "admin" && stats && (
        <AdminDashboard
          stats={stats as AdminStats}
          chartData={chartData}
          locale={locale}
          t={t}
        />
      )}

      {userRole === "installer" && stats && (
        <InstallerDashboard
          stats={stats as InstallerStats}
          pipeline={pipeline}
          recentProjects={recentProjects}
          chartData={chartData}
          locale={locale}
          onStatusChange={refreshPipeline}
          t={t}
          tp={tp}
        />
      )}

      {userRole !== "admin" && userRole !== "installer" && stats && (
        <ParticularDashboard
          stats={stats as ParticularStats}
          recentProjects={recentProjects}
          t={t}
        />
      )}
    </div>
  );
}

/* ---------- Particulier ---------- */
function ParticularDashboard({
  stats,
  recentProjects,
  t,
}: {
  stats: ParticularStats;
  recentProjects: RecentProject[];
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          icon={FolderKanban}
          label={t("totalProjects")}
          value={stats.nb_projects}
          color="blue"
        />
        <KPICard
          icon={Zap}
          label={t("totalKwc")}
          value={`${stats.total_kwc.toFixed(1)} kWc`}
          color="amber"
        />
        <KPICard
          icon={PiggyBank}
          label={t("totalSavings")}
          value={`${stats.total_savings.toLocaleString("fr-FR")} FCFA/an`}
          color="green"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("recentProjects")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentProjects.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <Sun className="size-12 mx-auto text-amber-500" />
              <p className="text-lg font-medium">{t("emptyTitle")}</p>
              <p className="text-muted-foreground">{t("emptyCta")}</p>
              <Link href="/projects">
                <Button>
                  <Plus className="size-4 mr-2" />
                  {t("newProject")}
                </Button>
              </Link>
            </div>
          ) : (
            <RecentProjectsTable projects={recentProjects} />
          )}
        </CardContent>
      </Card>
    </>
  );
}

/* ---------- Installateur ---------- */
function InstallerDashboard({
  stats,
  pipeline,
  recentProjects,
  chartData,
  locale,
  onStatusChange,
  t,
  tp,
}: {
  stats: InstallerStats;
  pipeline: PipelineData | null;
  recentProjects: RecentProject[];
  chartData: ChartData | null;
  locale: string;
  onStatusChange: () => void;
  t: ReturnType<typeof useTranslations>;
  tp: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          icon={Users}
          label={t("nbClients")}
          value={stats.nb_clients}
          color="blue"
        />
        <KPICard
          icon={FolderKanban}
          label={t("totalProjects")}
          value={stats.nb_projects}
          color="purple"
        />
        <KPICard
          icon={Zap}
          label={t("totalKwc")}
          value={`${stats.total_kwc.toFixed(1)} kWc`}
          color="amber"
        />
        <KPICard
          icon={TrendingUp}
          label={t("caDevis")}
          value={`${stats.ca_devis_accepted.toLocaleString("fr-FR")} F`}
          color="green"
        />
        <KPICard
          icon={Activity}
          label={t("activeProjects")}
          value={stats.active_projects}
          color="red"
        />
      </div>

      {/* Pipeline Kanban */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pipeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          {pipeline ? (
            <PipelineBoard
              pipeline={pipeline}
              onStatusChange={onStatusChange}
            />
          ) : (
            <Skeleton className="h-48" />
          )}
        </CardContent>
      </Card>

      {/* Recent projects table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("recentProjects")}</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentProjectsTable
            projects={recentProjects}
            showClient
            showQuote
          />
        </CardContent>
      </Card>

      {/* Chart: projects by month */}
      {chartData && chartData.projects_by_month.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("projectsByMonth")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={formatMonthData(chartData.projects_by_month, locale)}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis allowDecimals={false} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#1e3a5f"
                  radius={[4, 4, 0, 0]}
                  name={tp("titlePlural")}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ---------- Admin ---------- */
function AdminDashboard({
  stats,
  chartData,
  locale,
  t,
}: {
  stats: AdminStats;
  chartData: ChartData | null;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          label={t("totalUsers")}
          value={stats.total_users}
          color="blue"
        />
        <KPICard
          icon={FolderKanban}
          label={t("totalProjects")}
          value={stats.total_projects}
          color="purple"
        />
        <KPICard
          icon={Zap}
          label={t("totalKwc")}
          value={`${stats.total_kwc.toFixed(1)} kWc`}
          color="amber"
        />
        <KPICard
          icon={UserCheck}
          label={t("nbInstallers")}
          value={stats.nb_installers}
          color="green"
        />
      </div>

      {/* Charts */}
      {chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {chartData.registrations_by_month &&
            chartData.registrations_by_month.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("registrationsByMonth")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={formatMonthData(
                        chartData.registrations_by_month,
                        locale
                      )}
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis allowDecimals={false} className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        name={t("registrations")}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

          {chartData.projects_by_month.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("projectsByMonth")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={formatMonthData(
                      chartData.projects_by_month,
                      locale
                    )}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="#1e3a5f"
                      radius={[4, 4, 0, 0]}
                      name={t("projects")}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Admin links */}
      <Card>
        <CardHeader>
          <CardTitle>{t("adminActions")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Link href="/admin">
            <Button variant="outline">
              <Shield className="size-4 mr-2" />
              {t("manageUsers")}
            </Button>
          </Link>
          <Link href="/equipment">
            <Button variant="outline">
              <Zap className="size-4 mr-2" />
              {t("manageEquipment")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
