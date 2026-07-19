import { PasswordSetForm } from "@/components/auth/PasswordSetForm";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <PasswordSetForm
      token={token ?? ""}
      endpoint="/api/auth/accept-invite"
      redirectTo="/"
      title="Welcome — set a password to finish setting up your account."
      submitLabel="Create account"
    />
  );
}
