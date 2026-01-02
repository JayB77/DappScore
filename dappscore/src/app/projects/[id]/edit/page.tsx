import EditProject from './EditProject';

// Generate static params for export
export function generateStaticParams() {
  // Pre-generate paths for IDs 1-100
  return Array.from({ length: 100 }, (_, i) => ({
    id: String(i + 1),
  }));
}

export default function EditProjectPage() {
  return <EditProject />;
}
