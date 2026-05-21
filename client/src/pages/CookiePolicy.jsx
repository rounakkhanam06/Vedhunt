import LegalPageLayout from '../components/layout/LegalPageLayout';

export default function CookiePolicy() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      description="How we use cookies to improve your experience"
      lastUpdated="May 2024"
    >
      <div className="space-y-8 text-center py-12">
        <h2 className="text-2xl font-bold font-heading text-app-text">Coming Soon</h2>
        <p className="text-slate-600 dark:text-app-text-muted">
          We are currently updating our Cookie Policy. Please check back later or contact us at <a href="mailto:info@vedhunt.in" className="text-primary hover:underline">info@vedhunt.in</a> if you have any immediate questions.
        </p>
      </div>
    </LegalPageLayout>
  );
}
