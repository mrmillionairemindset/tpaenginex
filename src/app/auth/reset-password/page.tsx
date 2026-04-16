import ResetPasswordForm from '@/components/auth/reset-password-form';

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string; email?: string };
}) {
  const token = searchParams.token || '';
  const email = searchParams.email || '';

  return <ResetPasswordForm token={token} email={email} />;
}
