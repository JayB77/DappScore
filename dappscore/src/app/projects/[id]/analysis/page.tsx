import AnalysisPage from './AnalysisPage';

// Static export requires at least one pre-rendered shell.
// All real project data is fetched client-side via useParams() + API calls,
// so this single shell works for any project ID at runtime.
export function generateStaticParams() {
  return [{ id: 'index' }];
}

export default function ProjectAnalysisPage() {
  return <AnalysisPage />;
}
