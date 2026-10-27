"use client";

import React from "react";
import SettingsNav from "@/components/settings/SettingsNav";
import CustomerNotificationSection from "@/components/settings/CustomerNotificationSection";
import { ShieldAlert, BellRing, Smartphone } from "lucide-react";

export default function NotificationSettingsClient() {
  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-[var(--text-main)] transition-colors">
      <SettingsNav
        activeKey="notifications"
        title="Notification Preferences"
        subtitle="Manage live lock-screen push alerts, order milestone notifications, and active devices."
      />

      <div className="space-y-8">
        {/* Full dedicated notification management section */}
        <CustomerNotificationSection />

        {/* Informative Guidance & Privacy Guarantee */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
              <BellRing size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                Instant Lock-Screen Alerts
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Receive live updates when the restaurant accepts your order, when the kitchen begins cooking, and when your courier is arriving at your doorstep.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                Zero Spam Guarantee
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                We only dispatch notifications for critical order status changes and opt-in kitchen deals. You can revoke device access anytime with one click.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
