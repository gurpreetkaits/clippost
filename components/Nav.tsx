"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { Crown, Settings, Scissors, LogIn, LogOut, Film, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const navLinks = [
  { href: "/pricing", label: "Pricing", icon: Crown, auth: false },
  { href: "/clips", label: "Clips", icon: Film, auth: true },
  { href: "/settings", label: "Settings", icon: Settings, auth: true },
] as const;

export default function Nav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (pathname === "/login") return null;

  const user = session?.user;

  return (
    <nav className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-bold tracking-tight text-foreground"
        >
          <Scissors className="h-4 w-4" />
          ClipPost
        </Link>

        <div className="flex items-center gap-1">
          {navLinks.filter((l) => !l.auth || status === "authenticated").map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  active
                    ? "text-foreground bg-muted font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}

          <a
            href="https://x.com/intent/tweet?text=Hey%20%40gurpreetkait%20here%27s%20my%20feedback%20on%20ClipPost%3A%20"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Feedback
          </a>

          {status === "authenticated" && user ? (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
              <Avatar className="h-7 w-7">
                {user.image && (
                  <AvatarImage src={user.image} alt={user.name || ""} />
                )}
                <AvatarFallback className="text-xs">
                  {user.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground hidden sm:inline max-w-[120px] truncate">
                {user.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : status === "unauthenticated" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signIn("google")}
              className="text-muted-foreground hover:text-foreground ml-2"
            >
              <LogIn className="h-3.5 w-3.5 mr-1.5" />
              Sign in
            </Button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
