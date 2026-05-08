import { PageShell } from "@/components/ui/PageShell";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageShell>{children}</PageShell>;
}
