import { UserPortalLogin } from "@/components/user-portal-login";

export const metadata = {
  title: "Participant Portal | IEEE 30 Days Skill Challenge",
  description: "Sign in with your registered Gmail to access track quizzes and your official Certificate of Achievement.",
};

export default function UserLoginPage() {
  return (
    <main className="min-h-screen bg-background py-8">
      <UserPortalLogin />
    </main>
  );
}
