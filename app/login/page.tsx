import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <AppLogo size={80} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">IEEE Portal Login</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose the portal you want to access. Sign-in is secured with your verified Gmail address.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Link href="/admin/login" className="group block">
            <Card className="glass-card h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Admin Portal
                </CardTitle>
                <CardDescription>
                  View all registrations, manage community managers, and configure learning tracks and WhatsApp groups.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm font-medium text-primary">Open admin login →</CardContent>
            </Card>
          </Link>

          <Link href="/community/login" className="group block">
            <Card className="glass-card h-full transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" /> Community Manager Portal
                </CardTitle>
                <CardDescription>
                  Health check of the registration pipeline and access to your community track&apos;s participants.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm font-medium text-primary">Open manager login →</CardContent>
            </Card>
          </Link>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Need to sign up for the challenge?{" "}
          <Link href="/" className="underline underline-offset-2 text-primary">
            Go to the registration form
          </Link>
          .
        </p>
      </div>
    </main>
  );
}