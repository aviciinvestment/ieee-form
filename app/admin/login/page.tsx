import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { PortalLoginForm } from "@/components/portal-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <AppLogo size={72} />
          <h1 className="mt-3 text-2xl font-bold tracking-tight">ADMIN PORTAL</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with an authorized admin Gmail account.</p>
        </div>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Admin Login</CardTitle>
            <CardDescription>Only authorized administrators can access this portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <PortalLoginForm requiredRole="admin" redirectPath="/admin" />
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-2">
            Back to portal selection
          </Link>
        </p>
      </div>
    </main>
  );
}