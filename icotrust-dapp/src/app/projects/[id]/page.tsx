import ProjectDetail from './ProjectDetail';

// Generate static params for export
export function generateStaticParams() {
  // Pre-generate paths for IDs 1-100
  // Actual project data is fetched client-side from blockchain
  return Array.from({ length: 100 }, (_, i) => ({
    id: String(i + 1),
  }));
}

export default function ProjectPage() {
  return <ProjectDetail />;
}
