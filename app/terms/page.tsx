import Link from "next/link";

export const metadata = {
  title: "Terms of Service - ClipPost",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto prose prose-sm prose-neutral dark:prose-invert">
        <h1 className="text-xl font-semibold mb-6">Terms of Service</h1>
        <p className="text-xs text-muted-foreground mb-8">Last updated: February 24, 2026</p>

        <section className="space-y-4 text-sm text-muted-foreground">
          <h2 className="text-base font-medium text-foreground">1. Acceptance of Terms</h2>
          <p>
            By accessing or using ClipPost (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
          </p>

          <h2 className="text-base font-medium text-foreground">2. What ClipPost Does</h2>
          <p>
            ClipPost helps you create short-form video clips from YouTube videos. The Service can download videos, transcribe audio, select segments using AI, add captions, and publish clips to platforms like Instagram and YouTube on your behalf.
          </p>

          <h2 className="text-base font-medium text-foreground">3. Your Account</h2>
          <p>
            You sign in via Google. You are responsible for all activity under your account. You must not share your API key with unauthorized parties.
          </p>

          <h2 className="text-base font-medium text-foreground">4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Use the Service to infringe on any copyright or intellectual property rights.</li>
            <li>Create clips from content you do not have the right to repurpose.</li>
            <li>Use the Service for spam, harassment, or any unlawful purpose.</li>
            <li>Attempt to reverse-engineer, abuse, or overload the Service.</li>
          </ul>

          <h2 className="text-base font-medium text-foreground">5. Content Responsibility</h2>
          <p>
            You are solely responsible for the content you create and publish through ClipPost. We do not review clips before publishing. Ensure you have the right to use, modify, and distribute the source video content.
          </p>

          <h2 className="text-base font-medium text-foreground">6. Third-Party Services</h2>
          <p>
            ClipPost integrates with YouTube, Instagram, and other third-party platforms. Your use of those platforms is governed by their respective terms. ClipPost is not responsible for third-party service availability or policies.
          </p>

          <h2 className="text-base font-medium text-foreground">7. AI-Generated Content</h2>
          <p>
            ClipPost uses AI (OpenAI, Sarvam) to transcribe audio, select video segments, and generate captions. AI output may not always be accurate. You should review all content before publishing.
          </p>

          <h2 className="text-base font-medium text-foreground">8. Subscription and Billing</h2>
          <p>
            ClipPost offers a free tier with usage limits and a paid Pro plan. Billing is handled through Polar. Subscriptions renew automatically unless cancelled. Refunds are handled on a case-by-case basis.
          </p>

          <h2 className="text-base font-medium text-foreground">9. Service Availability</h2>
          <p>
            We strive to keep ClipPost available but do not guarantee uninterrupted service. We may modify, suspend, or discontinue features at any time.
          </p>

          <h2 className="text-base font-medium text-foreground">10. Limitation of Liability</h2>
          <p>
            ClipPost is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages resulting from your use of the Service, including but not limited to lost data, failed publishes, or account suspensions on third-party platforms.
          </p>

          <h2 className="text-base font-medium text-foreground">11. Changes to Terms</h2>
          <p>
            We may update these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.
          </p>

          <h2 className="text-base font-medium text-foreground">12. Contact</h2>
          <p>
            Questions? Reach out on{" "}
            <a
              href="https://x.com/gurpreetkait"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              X (@gurpreetkait)
            </a>
            .
          </p>
        </section>

        <div className="mt-8 pt-4 border-t border-border">
          <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Privacy Policy &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
