import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Sidebar />
      <main className="flex-1 overflow-auto p-4 pt-16 lg:p-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
