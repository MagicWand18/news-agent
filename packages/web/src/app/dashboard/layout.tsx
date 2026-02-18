"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider } from "@/hooks/use-sidebar";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { useGlobalShortcuts } from "@/hooks/use-keyboard-shortcuts";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useGlobalShortcuts({
    onOpenCommandPalette: () => setCommandOpen(true),
    onOpenHelp: () => setShortcutsOpen(true),
  });

  return (
    <>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Sidebar />
        <main className="flex-1 overflow-auto p-4 pt-16 lg:p-8 lg:pt-8 transition-all duration-300">
          {children}
        </main>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  );
}
