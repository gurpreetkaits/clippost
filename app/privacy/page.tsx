import Link from "next/link";

export const metadata = {
  title: "Privacy Policy - ClipPost",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto prose prose-sm prose-neutral dark:prose-invert">
        <h1 className="text-xl font-semibold mb-6">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mb-8">Last updated: February 24, 2026</p>

        <section className="space-y-4 text-sm text-muted-foreground">
          <h2 className="text-base font-medium text-foreground">1. What We Collect</h2>
          <p>When you use ClipPost, we collect:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Google account info</strong> &mdash; name, email, and profile picture (via Google Sign-In).</li>
            <li><strong>Connected platform tokens</strong> &mdash; Instagram and YouTube access tokens to publish on your behalf. These are stored encrypted in our database.</li>
            <li><strong>Usage data</strong> &mdash; clips created, videos downloaded, and publishes made (for enforcing plan limits).</li>
            <li><strong>Video data</strong> &mdash; YouTube URLs you provide, video metadata (title, duration), and transcriptions generated during processing.</li>
          </ul>

          <h2 className="text-base font-medium text-foreground">2. What We Do NOT Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>We do not collect your Google password.</li>
            <li>We do not track you across other websites.</li>
            <li>We do not sell your data to third parties.</li>
            <li>We do not use analytics or advertising trackers.</li>
          </ul>

          <h2 className="text-base font-medium text-foreground">3. How We Use Your Data</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Authentication</strong> &mdash; to identify you and protect your account.</li>
            <li><strong>Clip creation</strong> &mdash; to download videos, transcribe audio, and generate clips.</li>
            <li><strong>Publishing</strong> &mdash; to post clips to Instagram and YouTube using your connected accounts.</li>
            <li><strong>Usage tracking</strong> &mdash; to enforce free/Pro plan limits.</li>
            <li><strong>Billing</strong> &mdash; subscription management via Polar (we do not store payment details directly).</li>
          </ul>

          <h2 className="text-base font-medium text-foreground">4. Third-Party Services</h2>
          <p>ClipPost sends data to the following services as part of its core functionality:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Google / YouTube API</strong> &mdash; for authentication and YouTube publishing.</li>
            <li><strong>Meta / Instagram Graph API</strong> &mdash; for Instagram Reel publishing.</li>
            <li><strong>OpenAI API</strong> &mdash; for transcription (Whisper), segment selection, and caption generation. Your video audio and transcripts are sent to OpenAI for processing.</li>
            <li><strong>Sarvam AI</strong> &mdash; for non-English transcription. Audio chunks are sent to Sarvam for processing.</li>
            <li><strong>Polar</strong> &mdash; for subscription billing. Polar handles payment processing.</li>
            <li><strong>tmpfiles.org</strong> &mdash; clips are temporarily uploaded to a public URL for Instagram publishing. Files expire automatically.</li>
          </ul>

          <h2 className="text-base font-medium text-foreground">5. Data Storage</h2>
          <p>
            Your account data and metadata are stored in a PostgreSQL database. Video files and clips are stored temporarily on our server and may be cleaned up periodically. We do not retain video files long-term.
          </p>

          <h2 className="text-base font-medium text-foreground">6. API Keys</h2>
          <p>
            If you generate an API key for MCP/chatbot integration, it is stored in our database. Treat it like a password. You can revoke it at any time from Settings.
          </p>

          <h2 className="text-base font-medium text-foreground">7. Data Deletion</h2>
          <p>
            You can disconnect your Instagram and YouTube accounts at any time from Settings, which removes stored tokens. To delete your entire account and associated data, contact us on X.
          </p>

          <h2 className="text-base font-medium text-foreground">8. Cookies</h2>
          <p>
            ClipPost uses a session cookie for authentication and an anonymous ID cookie for unauthenticated users. We do not use tracking or advertising cookies.
          </p>

          <h2 className="text-base font-medium text-foreground">9. Children</h2>
          <p>
            ClipPost is not intended for users under 13. We do not knowingly collect data from children.
          </p>

          <h2 className="text-base font-medium text-foreground">10. Changes to This Policy</h2>
          <p>
            We may update this policy at any time. Changes will be reflected on this page with an updated date.
          </p>

          <h2 className="text-base font-medium text-foreground">11. Contact</h2>
          <p>
            Questions about your data? Reach out on{" "}
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
          <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Terms of Service &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
