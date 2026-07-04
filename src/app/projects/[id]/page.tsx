import ProjectDashboard from "@/components/project-dashboard";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDashboard projectId={id} />;
}
