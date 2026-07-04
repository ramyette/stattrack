import ProjectAnalytics from "@/components/project-analytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectAnalytics projectId={id} />;
}
