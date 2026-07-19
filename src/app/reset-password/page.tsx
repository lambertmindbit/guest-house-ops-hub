import { PasswordSetForm } from "@/components/auth/PasswordSetForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <PasswordSetForm
      token={token ?? ""}
      endpoint="/api/auth/reset"
      redirectTo="/login"
      title="Choose a new password."
      submitLabel="Reset password"
    />
  );
}
