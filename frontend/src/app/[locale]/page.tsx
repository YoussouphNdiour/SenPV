import { redirect } from "next/navigation";

export default function LocaleHome({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Redirect to dashboard — auth middleware will redirect to login if needed
  return redirect(`/dashboard`);
}
