import AnalysisPage from './AnalysisPage';

export function generateStaticParams() {
  return Array.from({ length: 100 }, (_, i) => ({ id: String(i + 1) }));
}

export default function ProjectAnalysisPage() {
  return <AnalysisPage />;
}
