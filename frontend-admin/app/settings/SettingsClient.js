"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import SettingsSidebar, { SETTINGS_GROUPS } from "./components/SettingsSidebar";
import { useTheme } from "@/components/ui/ThemeProvider";

// Sections
import GeneralSection from "./components/GeneralSection";
import BusinessSection from "./components/BusinessSection";
import OrderingSection from "./components/OrderingSection";
import MenuSection from "./components/MenuSection";
import OffersSection from "./components/OffersSection";
import PaymentsSection from "./components/PaymentsSection";
import DeliverySection from "./components/DeliverySection";
import NotificationsSection from "./components/NotificationsSection";
import StaffSection from "./components/StaffSection";
import AppearanceSection from "./components/AppearanceSection";
import SecuritySection from "./components/SecuritySection";
import AdvancedSection from "./components/AdvancedSection";

import {
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export default function SettingsClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAccentColor } = useTheme();

  // Active section management
  const initialTab = searchParams.get("tab") || "general";
  const [activeSection, setActiveSection] = useState(initialTab);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tab !== activeSection) {
      setActiveSection(tab);
    }
  }, [searchParams]);

  function handleSelectSection(sectionId) {
    if (sectionId === "profile") {
      router.push("/profile");
      return;
    }
    setActiveSection(sectionId);
    router.replace(`/settings?tab=${sectionId}`, { scroll: false });
  }

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [meta, setMeta] = useState({});

  // Main Form State
  const [form, setForm] = useState({
    name: "",
    shortDescription: "",
    fullDescription: "",
    description: "",
    cuisineType: ["Fast Food"],
    category: "Casual Dining",
    tags: ["Pet Friendly"],
    image: "",
    bannerImage: "",
    phone: "",
    whatsappNumber: "",
    email: "",
    supportEmail: "",
    showPhoneToCustomers: true,
    showWhatsappToCustomers: true,
    address: {
      street: "",
      buildingFloor: "",
      landmark: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      latitude: 0,
      longitude: 0,
    },
    regionalSettings: {
      currency: "INR",
      currencySymbol: "₹",
      timezone: "Asia/Kolkata",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "12-hour",
    },
    isOpen: true,
    acceptingOrders: true,
    isTemporarilyClosed: false,
    closureReason: "",
    weeklyHours: {
      monday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
      tuesday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
      wednesday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
      thursday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
      friday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
      saturday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
      sunday: { isOpen: true, slots: [{ open: "10:00", close: "23:00" }] },
    },
    specialHours: [],
    prepTimeSettings: { defaultMinutes: 25, minMinutes: 15, maxMinutes: 60 },
    orderTypes: { delivery: true, pickup: true },
    orderingSettings: {
      autoAcceptOrders: false,
      requireOrderConfirmation: true,
      estimatedProcessingMinutes: 20,
      autoCancelTimeoutMinutes: 15,
    },
    orderLimits: { minOrderAmount: 0, maxOrderAmount: 50000, maxItemsPerOrder: 30 },
    cancellationSettings: {
      allowCustomerCancel: true,
      customerCancelWindowMinutes: 5,
      allowRestaurantCancel: true,
      requireCancelReason: true,
    },
    menuSettings: {
      productsVisible: true,
      showUnavailableProducts: true,
      defaultProductAvailable: true,
      outOfStockBehavior: "mark_unavailable",
      allowCustomization: true,
      categoriesVisible: true,
      categoryOrdering: "manual",
      hideEmptyCategories: true,
      menuVisible: true,
      showFeaturedProducts: true,
      showFeaturedCategories: true,
      enableSearch: true,
      enableFilters: true,
    },
    paymentSettings: {
      onlinePaymentEnabled: true,
      codEnabled: true,
      copEnabled: true,
      testPaymentMode: true,
    },
    taxSettings: {
      enabled: false,
      percentage: 5,
      inclusive: false,
      label: "GST",
    },
    chargeSettings: {
      packagingFee: 0,
      serviceFee: 0,
      convenienceFee: 0,
      flatDeliveryFee: 40,
      freeDeliveryThreshold: 500,
    },
    deliverySettings: {
      deliveryEnabled: true,
      pickupEnabled: true,
      deliveryRadiusKm: 10,
      serviceablePincodes: [],
      estimatedDeliveryMinutes: 35,
      minDeliveryMinutes: 20,
      maxDeliveryMinutes: 60,
      staffAssignmentMethod: "manual",
    },
    notificationSettings: {
      customerOrderPlaced: true,
      customerOrderConfirmed: true,
      customerOrderPreparing: true,
      customerOrderReady: true,
      customerOutForDelivery: true,
      customerDelivered: true,
      customerCancelled: true,
      restaurantNewOrder: true,
      restaurantCancelledOrder: true,
      restaurantPaymentFailure: true,
      restaurantCustomerMessage: true,
      channels: { inApp: true, email: true, whatsapp: false, push: true },
      audioChime: "bell",
    },
    appearance: {
      theme: "dark",
      primaryColor: "#f97316",
      secondaryColor: "#10141f",
      announcement: "",
    },
  });

  const [initialFormJson, setInitialFormJson] = useState("");

  // Check for unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialFormJson) return false;
    return JSON.stringify(form) !== initialFormJson;
  }, [form, initialFormJson]);

  // Auth Protection — Redirect unauthenticated users and route staff to orders
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && session?.user?.role === "staff") {
      router.replace("/orders");
    }
  }, [status, session, router]);

  // Update URL tab
  function handleSelectSection(id) {
    setActiveSection(id);
    const newUrl = `/settings?tab=${id}`;
    window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);
  }

  // Load Settings
  async function loadSettings() {
    try {
      setLoading(true);
      const res = await fetch("/api/restaurant/settings");
      const data = await res.json();
      if (data.success && data.restaurant) {
        const r = data.restaurant;
        const populated = {
          name: r.name || "",
          shortDescription: r.shortDescription || r.description || "",
          fullDescription: r.fullDescription || "",
          description: r.description || "",
          cuisineType: Array.isArray(r.cuisineType) ? r.cuisineType : ["Fast Food"],
          category: r.category || "Casual Dining",
          tags: Array.isArray(r.tags) ? r.tags : ["Pet Friendly"],
          image: r.image || "",
          bannerImage: r.bannerImage || "",
          phone: r.phone || "",
          whatsappNumber: r.whatsappNumber || "",
          email: r.email || "",
          supportEmail: r.supportEmail || "",
          showPhoneToCustomers: r.showPhoneToCustomers ?? true,
          showWhatsappToCustomers: r.showWhatsappToCustomers ?? true,
          address: {
            street: r.address?.street || "",
            buildingFloor: r.address?.buildingFloor || "",
            landmark: r.address?.landmark || "",
            city: r.address?.city || "",
            state: r.address?.state || "",
            pincode: r.address?.pincode || "",
            country: r.address?.country || "India",
            latitude: r.address?.latitude || 0,
            longitude: r.address?.longitude || 0,
          },
          regionalSettings: {
            currency: r.regionalSettings?.currency || "INR",
            currencySymbol: r.regionalSettings?.currencySymbol || "₹",
            timezone: r.regionalSettings?.timezone || "Asia/Kolkata",
            dateFormat: r.regionalSettings?.dateFormat || "DD/MM/YYYY",
            timeFormat: r.regionalSettings?.timeFormat || "12-hour",
          },
          isOpen: r.isOpen ?? true,
          acceptingOrders: r.acceptingOrders ?? true,
          isTemporarilyClosed: r.isTemporarilyClosed ?? false,
          closureReason: r.closureReason || "",
          weeklyHours: r.weeklyHours || form.weeklyHours,
          specialHours: Array.isArray(r.specialHours) ? r.specialHours : [],
          prepTimeSettings: r.prepTimeSettings || form.prepTimeSettings,
          orderTypes: r.orderTypes || form.orderTypes,
          orderingSettings: r.orderingSettings || form.orderingSettings,
          orderLimits: r.orderLimits || form.orderLimits,
          cancellationSettings: r.cancellationSettings || form.cancellationSettings,
          menuSettings: r.menuSettings || form.menuSettings,
          paymentSettings: r.paymentSettings || form.paymentSettings,
          taxSettings: r.taxSettings || form.taxSettings,
          chargeSettings: r.chargeSettings || form.chargeSettings,
          deliverySettings: r.deliverySettings || form.deliverySettings,
          notificationSettings: r.notificationSettings || form.notificationSettings,
          appearance: r.appearance || form.appearance,
        };
        setForm(populated);
        setInitialFormJson(JSON.stringify(populated));
        if (r.appearance?.primaryColor) {
          setAccentColor(r.appearance.primaryColor);
        }
        if (data.meta) setMeta(data.meta);
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to load settings." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "Failed to connect to restaurant settings server." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  function handleFieldChange(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  // Save Settings
  async function handleSaveSettings() {
    try {
      setSaving(true);
      setFeedback({ type: "", message: "" });

      const res = await fetch("/api/restaurant/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (data.success) {
        setFeedback({ type: "success", message: "All changes saved successfully!" });
        setInitialFormJson(JSON.stringify(form));
        setTimeout(() => setFeedback({ type: "", message: "" }), 4000);
      } else {
        setFeedback({ type: "error", message: data.message || "Failed to save settings." });
      }
    } catch (err) {
      console.error(err);
      setFeedback({ type: "error", message: "An unexpected error occurred while saving." });
    } finally {
      setSaving(false);
    }
  }

  // Cancel / Revert changes
  function handleCancelChanges() {
    if (initialFormJson) {
      try {
        const parsed = JSON.parse(initialFormJson);
        setForm(parsed);
        if (parsed.appearance?.primaryColor) {
          setAccentColor(parsed.appearance.primaryColor);
        }
        setFeedback({ type: "success", message: "Unsaved changes discarded." });
        setTimeout(() => setFeedback({ type: "", message: "" }), 3000);
      } catch (e) {
        console.error(e);
      }
    }
  }

  // Reset to Defaults (used by Advanced Section)
  function handleResetDefaults() {
    setForm((prev) => ({
      ...prev,
      isOpen: true,
      acceptingOrders: true,
      isTemporarilyClosed: false,
      closureReason: "",
      prepTimeSettings: { defaultMinutes: 25, minMinutes: 15, maxMinutes: 60 },
      orderLimits: { minOrderAmount: 0, maxOrderAmount: 50000, maxItemsPerOrder: 30 },
      taxSettings: { enabled: false, percentage: 5, inclusive: false, label: "GST" },
      chargeSettings: { packagingFee: 0, serviceFee: 0, convenienceFee: 0, flatDeliveryFee: 40, freeDeliveryThreshold: 500 },
      deliverySettings: { ...prev.deliverySettings, deliveryRadiusKm: 10, estimatedDeliveryMinutes: 35 },
    }));
    setFeedback({ type: "success", message: "Parameters reset to factory defaults. Click Save to persist." });
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] flex flex-col font-jakarta relative selection:bg-orange-500 selection:text-white transition-colors duration-200">
      {/* Soft warm ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-orange-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl opacity-70" />
      </div>

      {/* Main Content Container with two independent scrollable components */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-16 lg:h-screen lg:overflow-hidden flex flex-col">
        {/* Layout: Sidebar + Active Section as two distinct components */}
        <div className="flex-1 flex flex-col lg:flex-row gap-0 lg:gap-8 lg:overflow-hidden py-4 sm:py-6">
          {/* Component 1: Left Sidebar Pane (Independently scrollable on desktop) */}
          <div className="w-full lg:w-64 shrink-0 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto lg:border-r border-zinc-200/90 dark:border-zinc-800/90 lg:pr-5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <SettingsSidebar
              activeSection={activeSection}
              onSelectSection={handleSelectSection}
            />
          </div>

          {/* Component 2: Right Settings Content Panel (Independently scrollable on desktop) */}
          <div className="flex-1 w-full min-w-0 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pl-2 pb-28">
            {/* Global Feedback Alert */}
            {feedback.message && (
              <div
                className={`mb-6 p-4 rounded-2xl flex items-center gap-3 text-sm font-medium ${
                  feedback.type === "success"
                    ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            {loading ? (
              <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading settings...</p>
              </div>
            ) : (
              <div>
                {activeSection === "general" && (
                  <GeneralSection
                    form={form}
                    onChange={handleFieldChange}
                    onSave={handleSaveSettings}
                    saving={saving}
                  />
                )}

                {activeSection === "business" && (
                  <BusinessSection
                    form={form}
                    onChange={handleFieldChange}
                    onSave={handleSaveSettings}
                    saving={saving}
                  />
                )}

                {activeSection === "ordering" && (
                  <OrderingSection
                    form={form}
                    onChange={handleFieldChange}
                    onSave={handleSaveSettings}
                    saving={saving}
                  />
                )}

                {activeSection === "payments" && (
                  <PaymentsSection
                    form={form}
                    onChange={handleFieldChange}
                    onSave={handleSaveSettings}
                    saving={saving}
                  />
                )}

                {activeSection === "menu" && (
                  <MenuSection
                    form={form}
                    onChange={handleFieldChange}
                    onSave={handleSaveSettings}
                    saving={saving}
                  />
                )}

                {activeSection === "offers" && <OffersSection />}

                {activeSection === "delivery" && (
                  <DeliverySection
                    form={form}
                    onChange={handleFieldChange}
                    onSave={handleSaveSettings}
                    saving={saving}
                  />
                )}

                {activeSection === "staff" && <StaffSection />}

                {activeSection === "appearance" && (
                  <AppearanceSection
                    form={form}
                    onChange={handleFieldChange}
                    onSave={handleSaveSettings}
                    saving={saving}
                  />
                )}

                {activeSection === "security" && <SecuritySection />}

                {activeSection === "advanced" && (
                  <AdvancedSection
                    form={form}
                    meta={meta}
                    onChange={handleFieldChange}
                    onSave={handleSaveSettings}
                    onResetDefaults={handleResetDefaults}
                    saving={saving}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Compact Floating Bottom Action Bar for Unsaved Changes */}
        {hasUnsavedChanges && (
          <div className="fixed bottom-6 right-6 sm:right-10 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/95 dark:bg-[#10141f]/95 border border-zinc-200 dark:border-zinc-800 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 transition-all">
            <div className="flex items-center gap-2 pr-1">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Unsaved changes
              </span>
            </div>
            <button
              onClick={handleCancelChanges}
              disabled={saving}
              type="button"
              className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              type="button"
              className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
