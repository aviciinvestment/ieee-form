import { CertificatePortal } from "@/components/certificate-portal";

export const metadata = {
  title: "Certificate of Achievement | IEEE 30 Days Skill Challenge",
  description: "Access, view, and download your official approved Certificate of Achievement.",
};

export default function CertificatePage() {
  return (
    <main className="min-h-screen bg-background py-8">
      <CertificatePortal />
    </main>
  );
}
