"use client";

export default function AppShell({ children }) {
  // Pure Superadmin Shell (Space Grotesk typography)
  return (
    <div className="min-h-screen flex flex-col font-space-grotesk">
      <div className="flex-1">{children}</div>
    </div>
  );
}
