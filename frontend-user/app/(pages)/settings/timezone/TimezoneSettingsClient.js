"use client";

import React from "react";
import SettingsNav from "@/components/settings/SettingsNav";
import TimezoneSelector from "@/components/ui/TimezoneSelector";
import { Clock, MapPin, Compass } from "lucide-react";

export default function TimezoneSettingsClient() {
  return (
    <main className="min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-[var(--text-main)] transition-colors">
      <SettingsNav
        activeKey="timezone"
        title="Time Zone & Operational Clock"
        subtitle="Control which time zone is used to compute kitchen opening hours and order delivery timestamps."
      />

      <div className="space-y-8">
        {/* Dedicated full TimezoneSelector component */}
        <TimezoneSelector />

        {/* Helpful Regional Time Explanation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-accent)]/15 text-[var(--brand-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <Clock size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                Kitchen Opening Hours Synchronization
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Restaurants compute their daily breakfast, lunch, and dinner operating slots according to the selected operational clock.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xs flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                Local Delivery ETA Calculation
              </h4>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Estimated arrival times for your food orders are formatted into your local time so you know exactly when to expect your delivery.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
