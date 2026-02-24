import Link from "next/link";
import { Scissors } from "lucide-react";

const FEEDBACK_URL =
  "https://x.com/intent/tweet?text=Hey%20%40gurpreetkait%20here%27s%20my%20feedback%20on%20ClipPost%3A%20";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Brand */}
          <div className="space-y-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm font-bold tracking-tight text-foreground"
            >
              <Scissors className="h-4 w-4" />
              ClipPost
            </Link>
            <p className="text-xs text-muted-foreground max-w-xs">
              Turn YouTube videos into captioned Reels and Shorts.
              Built by{" "}
              <a
                href="https://x.com/gurpreetkait"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground transition-colors"
              >
                @gurpreetkait
              </a>
            </p>
          </div>

          {/* Links */}
          <div className="flex gap-8 text-sm">
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Product</p>
              <nav className="flex flex-col gap-1.5">
                <Link
                  href="/pricing"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pricing
                </Link>
                <a
                  href={FEEDBACK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Feedback
                </a>
              </nav>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Legal</p>
              <nav className="flex flex-col gap-1.5">
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms
                </Link>
                <Link
                  href="/privacy"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Privacy
                </Link>
              </nav>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Connect</p>
              <nav className="flex flex-col gap-1.5">
                <a
                  href="https://x.com/gurpreetkait"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  X (Twitter)
                </a>
              </nav>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} ClipPost</span>
          <a
            href={FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Send feedback on X
          </a>
        </div>
      </div>
    </footer>
  );
}
