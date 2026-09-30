"use client";

import { useState, useRef, useEffect } from "react";
import {
  Building2,
  Clock,
  ShoppingBag,
  CreditCard,
  UtensilsCrossed,
  Tag,
  Truck,
  Users,
  Palette,
  ShieldCheck,
  Cpu,
  User,
  ChevronDown,
  Check,
  X,
} from "lucide-react";

import { useSession } from "next-auth/react";

export const SETTINGS_GROUPS = [
  {
    title: "GENERAL",
    items: [
      { id: "general", label: "Restaurant", icon: Building2 },
      { id: "business", label: "Opening Hours", icon: Clock },
    ],
  },
  {
    title: "ORDERS",
    items: [
      { id: "ordering", label: "Orders", icon: ShoppingBag },
      { id: "payments", label: "Payments", icon: CreditCard },
    ],
  },
  {
    title: "MENU",
    items: [
      { id: "menu", label: "Menu", icon: UtensilsCrossed },
      { id: "offers", label: "Offers", icon: Tag },
    ],
  },
  {
    title: "DELIVERY",
    items: [
      { id: "delivery", label: "Delivery", icon: Truck },
    ],
  },
  {
    title: "PEOPLE",
    items: [
      { id: "staff", label: "Staff", icon: Users },
    ],
  },
  {
    title: "LOOK & FEEL",
    items: [
      { id: "appearance", label: "Appearance", icon: Palette },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { id: "profile", label: "Profile", icon: User },
      { id: "security", label: "Security", icon: ShieldCheck },
    ],
  },
  {
    title: "MORE",
    items: [
      { id: "advanced", label: "Advanced", icon: Cpu },
    ],
  },
];

export default function SettingsSidebar({ activeSection, onSelectSection }) {
  const { data: session } = useSession();
  const enabledFeatures = session?.user?.enabledFeatures;

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const pillContainerRef = useRef(null);

  const activeGroups = Array.isArray(enabledFeatures)
    ? SETTINGS_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.id === "delivery") return enabledFeatures.includes("delivery");
          if (item.id === "offers") return enabledFeatures.includes("offers");
          return true;
        }),
      })).filter((group) => group.items.length > 0)
    : SETTINGS_GROUPS;

  const allItems = activeGroups.flatMap((g) => g.items);
  const currentItem = allItems.find((i) => i.id === activeSection) || allItems[0] || { id: "general", label: "Settings", icon: Building2 };
  const currentGroup =
    activeGroups.find((g) => g.items.some((i) => i.id === activeSection)) ||
    activeGroups[0];
  const CurrentIcon = currentItem.icon;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Keep active horizontal pill visible in view
  useEffect(() => {
    if (pillContainerRef.current) {
      const activeEl = pillContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [activeSection]);

  return (
    <aside className="w-full">
      {/* Desktop Sidebar Pane */}
      <div className="hidden lg:block space-y-2 pb-6">
        <div className="px-2 pb-3 mb-2 border-b border-zinc-200/80 dark:border-zinc-800/80">
          <h2 className="text-xs font-black uppercase tracking-wider text-orange-500">Settings</h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">Restaurant Administration</p>
        </div>

        <nav className="space-y-3 pr-1">
          {activeGroups.map((group) => (
            <div key={group.title}>
              <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {group.title}
              </div>
              <div className="mt-0.5 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectSection(item.id)}
                      type="button"
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer ${
                        isActive
                          ? "bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30 font-semibold shadow-xs"
                          : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-transparent"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? "text-orange-600 dark:text-orange-400" : "text-zinc-400 dark:text-zinc-500"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 shadow-xs shadow-orange-500/50" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Mobile Custom Dropdown & Quick Horizontal Pills */}
      <div className="lg:hidden mb-5 space-y-2.5" ref={dropdownRef}>
        <div className="relative">
          {/* Custom Sleek Dropdown Trigger Button */}
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-[#10141f] border border-zinc-200/90 dark:border-zinc-800/90 shadow-xs hover:border-orange-500/50 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/20">
                <CurrentIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    {currentGroup.title}
                  </span>
                  <span className="text-zinc-300 dark:text-zinc-700 text-xs">•</span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Settings Section</span>
                </div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {currentItem.label}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 text-xs font-semibold group-hover:bg-orange-500 group-hover:text-white transition-colors shrink-0">
              <span>Sections</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </button>

          {/* Custom Styled Dropdown Menu Overlay */}
          {isOpen && (
            <>
              {/* Dimmed backdrop on mobile for focused interaction */}
              <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity lg:hidden"
                onClick={() => setIsOpen(false)}
              />

              <div className="absolute top-full left-0 right-0 mt-2 z-50 p-3 bg-white dark:bg-[#121620] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-[70vh] overflow-y-auto space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-1 pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
                  <div>
                    <div className="text-xs font-bold text-zinc-900 dark:text-white">Settings Sections</div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Choose a section to view & edit</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {activeGroups.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <div className="px-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      {group.title}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeSection === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              onSelectSection(item.id);
                              setIsOpen(false);
                            }}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                              isActive
                                ? "bg-orange-500 text-white font-bold shadow-xs"
                                : "bg-zinc-50/80 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white border border-zinc-200/50 dark:border-zinc-800/50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-white" : "text-zinc-400 dark:text-zinc-500"}`} />
                              <span className="truncate">{item.label}</span>
                            </div>
                            {isActive && <Check className="w-3.5 h-3.5 shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Horizontal Quick Pill Scroller */}
        <div
          ref={pillContainerRef}
          className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 pt-0.5"
        >
          {allItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                data-active={isActive ? "true" : undefined}
                onClick={() => onSelectSection(item.id)}
                type="button"
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-orange-500 text-white font-semibold shadow-xs ring-2 ring-orange-500/20"
                    : "bg-white dark:bg-[#10141f] border border-zinc-200/90 dark:border-zinc-800/90 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-zinc-400 dark:text-zinc-500"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
