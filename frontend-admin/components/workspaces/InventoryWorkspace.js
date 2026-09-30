"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Package,
  Layers,
  ShoppingBag,
  Trash2,
  Users,
  BookOpen,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Calendar,
  Phone,
  MessageCircle,
  FileText,
  DollarSign,
  ChevronRight,
  X,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

export default function InventoryWorkspace({ restaurantName = "" }) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState("overview"); // overview, ingredients, purchases, waste, suppliers, recipes

  // Data states
  const [overviewData, setOverviewData] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [wasteRecords, setWasteRecords] = useState([]);
  const [thisMonthWaste, setThisMonthWaste] = useState(0);
  const [recipes, setRecipes] = useState([]);
  const [menuProducts, setMenuProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [ingredientForm, setIngredientForm] = useState({
    name: "",
    unit: "pieces",
    currentStock: 0,
    minimumStock: 10,
    costPerUnit: 0,
    supplier: "",
    supplierName: "",
  });

  const [detailIngredient, setDetailIngredient] = useState(null);
  const [ingredientHistory, setIngredientHistory] = useState([]);

  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockActionType, setStockActionType] = useState("add"); // "add" or "remove"
  const [stockForm, setStockForm] = useState({
    quantity: "",
    purchaseCost: "",
    supplier: "",
    reason: "Used",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    supplierName: "",
    supplierId: "",
    date: new Date().toISOString().split("T")[0],
    status: "received",
    notes: "",
    items: [{ ingredient: "", name: "", quantity: 1, unit: "pieces", unitCost: 0, totalCost: 0 }],
  });
  const [viewingPurchase, setViewingPurchase] = useState(null);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [supplierForm, setSupplierForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    items: "",
    notes: "",
  });

  const [wasteModalOpen, setWasteModalOpen] = useState(false);
  const [wasteForm, setWasteForm] = useState({
    ingredient: "",
    quantity: "",
    reason: "Spoiled",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [selectedProductRecipe, setSelectedProductRecipe] = useState(null);
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [recipeFormItems, setRecipeFormItems] = useState([
    { ingredient: "", ingredientName: "", quantity: 1, unit: "pieces" },
  ]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [ingredientFilter, setIngredientFilter] = useState("all"); // all, good, low, out

  // Load all initial data
  async function loadData(isSilent = false) {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [resOverview, resIng, resPur, resSup, resWaste, resRec] = await Promise.all([
        fetch("/api/restaurant/inventory/overview").then((r) => r.json()),
        fetch("/api/restaurant/inventory/ingredients").then((r) => r.json()),
        fetch("/api/restaurant/inventory/purchases").then((r) => r.json()),
        fetch("/api/restaurant/inventory/suppliers").then((r) => r.json()),
        fetch("/api/restaurant/inventory/waste").then((r) => r.json()),
        fetch("/api/restaurant/inventory/recipes").then((r) => r.json()),
      ]);

      if (resOverview.success) setOverviewData(resOverview.data);
      if (resIng.success) setIngredients(resIng.ingredients || []);
      if (resPur.success) setPurchases(resPur.purchases || []);
      if (resSup.success) setSuppliers(resSup.suppliers || []);
      if (resWaste.success) {
        setWasteRecords(resWaste.wasteRecords || []);
        setThisMonthWaste(resWaste.thisMonthWaste || 0);
      }
      if (resRec.success) {
        setRecipes(resRec.recipes || []);
        setMenuProducts(resRec.products || []);
      }
    } catch (err) {
      console.error("Failed to load inventory data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Open ingredient detail & load history
  async function openIngredientDetail(ing) {
    setDetailIngredient(ing);
    try {
      const res = await fetch(`/api/restaurant/inventory/ingredients/${ing._id}/stock`);
      const data = await res.json();
      if (data.success) {
        setDetailIngredient(data.ingredient);
        setIngredientHistory(data.history || []);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Open Add/Remove stock modal for an ingredient
  function handleOpenStockModal(ing, type = "add") {
    setDetailIngredient(ing);
    setStockActionType(type);
    setStockForm({
      quantity: "",
      purchaseCost: "",
      supplier: ing.supplierName || "",
      reason: "Used",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setStockModalOpen(true);
  }

  // Save stock adjustment
  async function handleSaveStock(e) {
    e.preventDefault();
    if (!detailIngredient || !stockForm.quantity || Number(stockForm.quantity) <= 0) return;

    try {
      const res = await fetch(`/api/restaurant/inventory/ingredients/${detailIngredient._id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: stockActionType,
          quantity: Number(stockForm.quantity),
          purchaseCost: Number(stockForm.purchaseCost) || 0,
          supplier: stockForm.supplier,
          reason: stockForm.reason,
          date: stockForm.date,
          notes: stockForm.notes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStockModalOpen(false);
        loadData(true);
        if (detailIngredient) {
          openIngredientDetail(detailIngredient);
        }
      } else {
        alert(data.message || "Failed to update stock");
      }
    } catch (err) {
      console.error("Stock adjust error:", err);
    }
  }

  // Add / Edit Ingredient Submit
  async function handleSaveIngredient(e) {
    e.preventDefault();
    try {
      const url = editingIngredient
        ? `/api/restaurant/inventory/ingredients/${editingIngredient._id}`
        : "/api/restaurant/inventory/ingredients";
      const method = editingIngredient ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ingredientForm.name,
          unit: ingredientForm.unit,
          currentStock: Number(ingredientForm.currentStock) || 0,
          minimumStock: Number(ingredientForm.minimumStock) || 0,
          costPerUnit: Number(ingredientForm.costPerUnit) || 0,
          supplier: ingredientForm.supplier || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIngredientModalOpen(false);
        setEditingIngredient(null);
        loadData(true);
      } else {
        alert(data.message || "Failed to save ingredient");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Delete ingredient
  async function handleDeleteIngredient(id) {
    if (!confirm("Are you sure you want to delete this ingredient?")) return;
    try {
      const res = await fetch(`/api/restaurant/inventory/ingredients/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        if (detailIngredient?._id === id) setDetailIngredient(null);
        loadData(true);
      } else {
        alert(data.message || "Failed to delete");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Save Supplier
  async function handleSaveSupplier(e) {
    e.preventDefault();
    try {
      const url = editingSupplier
        ? `/api/restaurant/inventory/suppliers/${editingSupplier._id}`
        : "/api/restaurant/inventory/suppliers";
      const method = editingSupplier ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierForm),
      });

      const data = await res.json();
      if (data.success) {
        setSupplierModalOpen(false);
        setEditingSupplier(null);
        loadData(true);
      } else {
        alert(data.message || "Failed to save supplier");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Record Waste
  async function handleSaveWaste(e) {
    e.preventDefault();
    try {
      const res = await fetch("/api/restaurant/inventory/waste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wasteForm),
      });

      const data = await res.json();
      if (data.success) {
        setWasteModalOpen(false);
        setWasteForm({
          ingredient: "",
          quantity: "",
          reason: "Spoiled",
          date: new Date().toISOString().split("T")[0],
          notes: "",
        });
        loadData(true);
      } else {
        alert(data.message || "Failed to record waste");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Save Purchase
  async function handleSavePurchase(e) {
    e.preventDefault();
    try {
      const calculatedTotal = purchaseForm.items.reduce(
        (sum, item) => sum + (Number(item.quantity) * Number(item.unitCost) || 0),
        0
      );

      const res = await fetch("/api/restaurant/inventory/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...purchaseForm,
          totalAmount: calculatedTotal,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPurchaseModalOpen(false);
        loadData(true);
      } else {
        alert(data.message || "Failed to save purchase");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Open recipe editor for a product
  function openRecipeEditor(product) {
    setSelectedProductRecipe(product);
    const existing = recipes.find((r) => r.product?._id === product._id || r.product === product._id);

    if (existing && Array.isArray(existing.ingredients) && existing.ingredients.length > 0) {
      setRecipeFormItems(
        existing.ingredients.map((ing) => ({
          ingredient: ing.ingredient?._id || ing.ingredient,
          ingredientName: ing.ingredientName,
          quantity: ing.quantity,
          unit: ing.unit,
        }))
      );
    } else {
      setRecipeFormItems([{ ingredient: "", ingredientName: "", quantity: 1, unit: "pieces" }]);
    }
    setRecipeModalOpen(true);
  }

  // Save recipe
  async function handleSaveRecipe(e) {
    e.preventDefault();
    if (!selectedProductRecipe) return;

    const validItems = recipeFormItems.filter((i) => i.ingredient && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      alert("Please add at least one ingredient to the recipe");
      return;
    }

    try {
      const res = await fetch("/api/restaurant/inventory/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: selectedProductRecipe._id,
          ingredients: validItems,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRecipeModalOpen(false);
        loadData(true);
      } else {
        alert(data.message || "Failed to save recipe");
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredients.filter((ing) => {
      if (ingredientFilter === "good" && ing.status !== "GOOD") return false;
      if (ingredientFilter === "low" && ing.status !== "LOW STOCK") return false;
      if (ingredientFilter === "out" && ing.status !== "OUT OF STOCK") return false;

      if (!searchQuery.trim()) return true;
      return ing.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
    });
  }, [ingredients, ingredientFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── CLEAN TOP HEADER (NO LARGE PURPLE HERO) ────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              Kitchen Inventory
            </span>
            {restaurantName && (
              <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                • {restaurantName}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white tracking-tight">
            Inventory
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5 font-medium">
            Keep track of your ingredients and stock.
          </p>
        </div>

        {/* Sync Button */}
        <button
          onClick={() => loadData(false)}
          disabled={refreshing || loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-white/10 transition shadow-2xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
          <span>Sync Stock</span>
        </button>
      </div>

      {/* ── 6 MAIN INVENTORY TABS ───────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "overview", label: "Overview", icon: Layers },
          { id: "ingredients", label: "Ingredients", icon: Package },
          { id: "purchases", label: "Purchases", icon: ShoppingBag },
          { id: "waste", label: "Waste", icon: Trash2 },
          { id: "suppliers", label: "Suppliers", icon: Users },
          { id: "recipes", label: "Recipes", icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-orange-500 text-white shadow-xs"
                  : "bg-white dark:bg-white/5 border border-stone-200/80 dark:border-white/10 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-white/10"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. OVERVIEW TAB                                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 shadow-xs">
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                Total Ingredients
              </span>
              <div className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white mt-1">
                {overviewData?.totalIngredients || 0}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#10141f] border border-amber-200 dark:border-amber-900/40 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                Low Stock
              </span>
              <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {overviewData?.lowStockCount || 0}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#10141f] border border-rose-200 dark:border-rose-900/40 shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">
                Out of Stock
              </span>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {overviewData?.outOfStockCount || 0}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 shadow-xs">
              <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                Today's Stock Used
              </span>
              <div className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white mt-1">
                ₹{(overviewData?.todayStockUsed || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Low Stock Alert Section */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="font-extrabold text-sm text-stone-900 dark:text-white uppercase tracking-wider">
                  Low Stock
                </h3>
              </div>
              <button
                onClick={() => {
                  setIngredientFilter("low");
                  setActiveTab("ingredients");
                }}
                className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
              >
                View All
              </button>
            </div>

            {overviewData?.lowStockItems?.length === 0 ? (
              <p className="text-xs text-stone-400 py-3 text-center">
                All ingredients have healthy stock levels.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {overviewData?.lowStockItems?.map((ing) => (
                  <div
                    key={ing._id}
                    className="p-3.5 rounded-xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/80 dark:border-white/5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="font-extrabold text-xs text-stone-900 dark:text-white">
                        {ing.name}
                      </h4>
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                        {ing.currentStock} {ing.unit} left
                      </p>
                      <p className="text-[11px] text-stone-400">
                        Minimum: {ing.minimumStock} {ing.unit}
                      </p>
                    </div>

                    <button
                      onClick={() => handleOpenStockModal(ing, "add")}
                      className="px-3 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
                    >
                      Restock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Section */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-stone-400" />
              <h3 className="font-extrabold text-sm text-stone-900 dark:text-white uppercase tracking-wider">
                Recent Activity
              </h3>
            </div>

            {overviewData?.recentActivity?.length === 0 ? (
              <p className="text-xs text-stone-400 py-3 text-center">
                No recent stock movements recorded.
              </p>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-white/5">
                {overviewData?.recentActivity?.map((act) => (
                  <div
                    key={act._id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          act.quantity > 0
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-stone-100 dark:bg-white/10 text-stone-500"
                        }`}
                      >
                        {act.quantity > 0 ? (
                          <ArrowUpRight size={13} />
                        ) : (
                          <ArrowDownRight size={13} />
                        )}
                      </span>
                      <span className="font-semibold text-stone-800 dark:text-stone-200 truncate">
                        {act.description}
                      </span>
                    </div>

                    <span className="text-[11px] text-stone-400 shrink-0">
                      {new Date(act.date).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. INGREDIENTS TAB (Main Inventory Page)                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "ingredients" && (
        <div className="space-y-4">
          {/* Subtitle & Add Ingredient Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-stone-900 dark:text-white">
                Ingredients
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                See what ingredients you have and how much is left.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingIngredient(null);
                setIngredientForm({
                  name: "",
                  unit: "pieces",
                  currentStock: 0,
                  minimumStock: 10,
                  costPerUnit: 0,
                  supplier: "",
                  supplierName: "",
                });
                setIngredientModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer w-fit"
            >
              <Plus size={14} />
              <span>Add Ingredient</span>
            </button>
          </div>

          {/* Search & Filter Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl p-3 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs sm:text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {[
                { id: "all", label: "All" },
                { id: "good", label: "Good" },
                { id: "low", label: "Low Stock" },
                { id: "out", label: "Out of Stock" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setIngredientFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                    ingredientFilter === pill.id
                      ? "bg-orange-500 text-white shadow-xs"
                      : "bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/10"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-stone-500 text-xs">
                Loading ingredients...
              </div>
            ) : filteredIngredients.length === 0 ? (
              <div className="p-12 text-center text-stone-400 text-xs">
                No ingredients found. Click "+ Add Ingredient" to create one.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-white/5 border-b border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-400 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Ingredient</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4">Unit</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-white/5">
                    {filteredIngredients.map((ing) => (
                      <tr
                        key={ing._id}
                        className="hover:bg-stone-50/70 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                        onClick={() => openIngredientDetail(ing)}
                      >
                        <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-white">
                          {ing.name}
                          {ing.supplierName && (
                            <span className="block text-[11px] font-normal text-stone-400 mt-0.5">
                              Supplier: {ing.supplierName}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-black text-sm text-stone-900 dark:text-white">
                          {ing.currentStock}
                        </td>

                        <td className="py-3.5 px-4 text-stone-600 dark:text-stone-300">
                          {ing.unit}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                              ing.status === "GOOD"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : ing.status === "LOW STOCK"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                            }`}
                          >
                            {ing.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenStockModal(ing, "add")}
                              className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 font-bold text-xs transition"
                            >
                              Add Stock
                            </button>

                            <button
                              onClick={() => {
                                setEditingIngredient(ing);
                                setIngredientForm({
                                  name: ing.name,
                                  unit: ing.unit,
                                  currentStock: ing.currentStock,
                                  minimumStock: ing.minimumStock,
                                  costPerUnit: ing.costPerUnit,
                                  supplier: ing.supplier || "",
                                  supplierName: ing.supplierName || "",
                                });
                                setIngredientModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 transition"
                              title="Edit Ingredient"
                            >
                              <Edit2 size={13} />
                            </button>

                            <button
                              onClick={() => handleDeleteIngredient(ing._id)}
                              className="p-1.5 rounded-lg bg-stone-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-stone-400 hover:text-rose-500 transition"
                              title="Delete Ingredient"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. PURCHASES TAB                                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "purchases" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-stone-900 dark:text-white">
                Purchases
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Keep track of ingredients you buy.
              </p>
            </div>

            <button
              onClick={() => {
                setPurchaseForm({
                  supplierName: "",
                  supplierId: "",
                  date: new Date().toISOString().split("T")[0],
                  status: "received",
                  notes: "",
                  items: [
                    {
                      ingredient: ingredients[0]?._id || "",
                      name: ingredients[0]?.name || "",
                      quantity: 10,
                      unit: ingredients[0]?.unit || "pieces",
                      unitCost: ingredients[0]?.costPerUnit || 10,
                      totalCost: 100,
                    },
                  ],
                });
                setPurchaseModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer w-fit"
            >
              <Plus size={14} />
              <span>New Purchase</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            {purchases.length === 0 ? (
              <div className="p-12 text-center text-stone-400 text-xs">
                No purchases recorded yet. Click "+ New Purchase" to log stock bought.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-white/5 border-b border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-400 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4">Items</th>
                      <th className="py-3 px-4">Total</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-white/5">
                    {purchases.map((pur) => (
                      <tr
                        key={pur._id}
                        className="hover:bg-stone-50/70 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                        onClick={() => setViewingPurchase(pur)}
                      >
                        <td className="py-3.5 px-4 font-semibold text-stone-800 dark:text-stone-200">
                          {new Date(pur.date).toLocaleDateString([], {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-white">
                          {pur.supplierName}
                        </td>

                        <td className="py-3.5 px-4 text-stone-600 dark:text-stone-300">
                          <span className="truncate max-w-[200px] block">
                            {pur.items?.map((i) => `${i.name}`).join(", ")}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-black text-sm text-stone-900 dark:text-white">
                          ₹{(pur.totalAmount || 0).toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                              pur.status === "received"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {pur.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingPurchase(pur);
                            }}
                            className="p-1.5 rounded-lg bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. WASTE TAB                                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "waste" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-stone-900 dark:text-white">Waste</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Record ingredients that were spoiled, damaged, or wasted.
              </p>
            </div>

            <button
              onClick={() => {
                setWasteForm({
                  ingredient: ingredients[0]?._id || "",
                  quantity: "",
                  reason: "Spoiled",
                  date: new Date().toISOString().split("T")[0],
                  notes: "",
                });
                setWasteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer w-fit"
            >
              <Plus size={14} />
              <span>Record Waste</span>
            </button>
          </div>

          {/* This Month's Waste Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                This Month's Waste
              </span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                ₹{thisMonthWaste.toLocaleString()}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Trash2 size={20} />
            </div>
          </div>

          <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            {wasteRecords.length === 0 ? (
              <div className="p-12 text-center text-stone-400 text-xs">
                No waste records logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-white/5 border-b border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-400 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Ingredient</th>
                      <th className="py-3 px-4">Quantity</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Estimated Loss</th>
                      <th className="py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-white/5">
                    {wasteRecords.map((w) => (
                      <tr key={w._id} className="hover:bg-stone-50/70 dark:hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-semibold text-stone-800 dark:text-stone-200">
                          {new Date(w.date).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 font-bold text-stone-900 dark:text-white">
                          {w.ingredientName}
                        </td>
                        <td className="py-3 px-4 text-stone-700 dark:text-stone-300">
                          {w.quantity} {w.unit}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-white/10 text-stone-700 dark:text-stone-300">
                            {w.reason}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-rose-600 dark:text-rose-400">
                          ₹{(w.cost || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-stone-400 text-[11px] truncate max-w-[150px]">
                          {w.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. SUPPLIERS TAB                                              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "suppliers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-stone-900 dark:text-white">
                Suppliers
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Keep your ingredient suppliers in one place.
              </p>
            </div>

            <button
              onClick={() => {
                setEditingSupplier(null);
                setSupplierForm({
                  name: "",
                  phone: "",
                  whatsapp: "",
                  email: "",
                  address: "",
                  items: "",
                  notes: "",
                });
                setSupplierModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer w-fit"
            >
              <Plus size={14} />
              <span>Add Supplier</span>
            </button>
          </div>

          <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl shadow-xs overflow-hidden">
            {suppliers.length === 0 ? (
              <div className="p-12 text-center text-stone-400 text-xs">
                No suppliers registered. Click "+ Add Supplier" to record your vendors.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-white/5 border-b border-stone-200 dark:border-white/10 text-stone-600 dark:text-stone-400 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Supplier Name</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">WhatsApp</th>
                      <th className="py-3 px-4">Items</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-white/5">
                    {suppliers.map((sup) => (
                      <tr key={sup._id} className="hover:bg-stone-50/70 dark:hover:bg-white/[0.02]">
                        <td className="py-3.5 px-4 font-bold text-stone-900 dark:text-white">
                          {sup.name}
                          {sup.address && (
                            <span className="block text-[11px] font-normal text-stone-400 mt-0.5 truncate max-w-[200px]">
                              {sup.address}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-stone-700 dark:text-stone-300">
                          <a href={`tel:${sup.phone}`} className="hover:underline flex items-center gap-1">
                            <Phone size={11} className="text-stone-400" />
                            <span>{sup.phone}</span>
                          </a>
                        </td>

                        <td className="py-3.5 px-4">
                          {sup.whatsapp ? (
                            <a
                              href={`https://wa.me/${sup.whatsapp.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                            >
                              <MessageCircle size={12} />
                              <span>{sup.whatsapp}</span>
                            </a>
                          ) : (
                            <span className="text-stone-400">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-stone-600 dark:text-stone-300">
                          {sup.items || "General"}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingSupplier(sup);
                                setSupplierForm(sup);
                                setSupplierModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-600 dark:text-stone-300 transition"
                            >
                              <Edit2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. RECIPES TAB (Connects Products with Ingredients)           */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "recipes" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-extrabold text-stone-900 dark:text-white">
              Recipes
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Tell us what ingredients are used to make each dish. Stock will automatically deduct when customers order.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {menuProducts.map((prod) => {
              const recipe = recipes.find((r) => r.product?._id === prod._id || r.product === prod._id);
              const ingCount = recipe?.ingredients?.length || 0;

              return (
                <div
                  key={prod._id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 shadow-xs flex flex-col justify-between gap-3 hover:border-orange-500/40 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-sm text-stone-900 dark:text-white">
                        {prod.name}
                      </h4>
                      <span className="text-[11px] text-stone-400 block mt-0.5">
                        {prod.category || "Dish"} • ₹{(prod.price || 0).toFixed(2)}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        ingCount > 0
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {ingCount > 0 ? `${ingCount} Ingredients` : "No Recipe"}
                    </span>
                  </div>

                  {recipe && recipe.ingredients?.length > 0 && (
                    <div className="space-y-1 text-xs text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-white/[0.02] p-2.5 rounded-xl border border-stone-100 dark:border-white/5">
                      {recipe.ingredients.slice(0, 3).map((ing, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{ing.ingredientName}</span>
                          <span className="font-semibold text-stone-800 dark:text-stone-200">
                            {ing.quantity} {ing.unit}
                          </span>
                        </div>
                      ))}
                      {recipe.ingredients.length > 3 && (
                        <span className="text-[10px] text-stone-400 block pt-0.5">
                          +{recipe.ingredients.length - 3} more ingredients...
                        </span>
                      )}
                    </div>
                  )}

                  <button
                    onClick={() => openRecipeEditor(prod)}
                    className="w-full py-2 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-orange-500 hover:text-white text-stone-700 dark:text-stone-300 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <BookOpen size={13} />
                    <span>{ingCount > 0 ? "Edit Recipe" : "Set Recipe"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* INGREDIENT DETAIL MODAL                                        */}
      {/* ───────────────────────────────────────────────────────────── */}
      {detailIngredient && !stockModalOpen && !ingredientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-stone-100 dark:border-white/5">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-orange-500">
                  Ingredient Details
                </span>
                <h3 className="text-xl font-black text-stone-900 dark:text-white mt-0.5">
                  {detailIngredient.name}
                </h3>
              </div>
              <button
                onClick={() => setDetailIngredient(null)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-white/5">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Current Stock</span>
                <span className="text-lg font-black text-stone-900 dark:text-white">
                  {detailIngredient.currentStock} {detailIngredient.unit}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-white/5">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Minimum Stock</span>
                <span className="text-lg font-black text-stone-900 dark:text-white">
                  {detailIngredient.minimumStock} {detailIngredient.unit}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-white/5">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Cost Per Unit</span>
                <span className="text-lg font-black text-stone-900 dark:text-white">
                  ₹{detailIngredient.costPerUnit || 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-white/5">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Status</span>
                <span className="text-xs font-black text-orange-500 uppercase mt-1 block">
                  {detailIngredient.status || "GOOD"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => handleOpenStockModal(detailIngredient, "add")}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition"
              >
                Add Stock
              </button>
              <button
                onClick={() => handleOpenStockModal(detailIngredient, "remove")}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 dark:bg-white/5 hover:bg-stone-200 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 font-bold text-xs transition"
              >
                Remove Stock
              </button>
            </div>

            {/* Stock Movement History */}
            <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-white/5">
              <span className="text-xs font-extrabold text-stone-900 dark:text-white uppercase tracking-wider block">
                Recent Stock Activity
              </span>
              {ingredientHistory.length === 0 ? (
                <p className="text-xs text-stone-400 py-3 text-center">
                  No stock history for this ingredient yet.
                </p>
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-white/5 text-xs max-h-48 overflow-y-auto">
                  {ingredientHistory.map((h) => (
                    <div key={h._id} className="py-2 flex items-center justify-between">
                      <div>
                        <span
                          className={`font-bold ${
                            h.quantity > 0 ? "text-emerald-600" : "text-stone-600 dark:text-stone-300"
                          }`}
                        >
                          {h.quantity > 0 ? `+${h.quantity}` : h.quantity} {h.unit}
                        </span>
                        <span className="text-stone-400 ml-2">{h.reason}</span>
                      </div>
                      <span className="text-[10px] text-stone-400">
                        {new Date(h.date).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ADD / REMOVE STOCK MODAL                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {stockModalOpen && detailIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/5">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-orange-500">
                  {stockActionType === "add" ? "Receive Stock" : "Manual Stock Removal"}
                </span>
                <h3 className="text-lg font-black text-stone-900 dark:text-white">
                  {stockActionType === "add" ? "Add Stock" : "Remove Stock"}: {detailIngredient.name}
                </h3>
              </div>
              <button onClick={() => setStockModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStock} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Quantity ({detailIngredient.unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                  placeholder={`e.g. 50 ${detailIngredient.unit}`}
                  className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-sm font-bold text-stone-900 dark:text-white"
                />
              </div>

              {stockActionType === "add" ? (
                <>
                  <div>
                    <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Purchase Cost (Total ₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={stockForm.purchaseCost}
                      onChange={(e) => setStockForm({ ...stockForm, purchaseCost: e.target.value })}
                      placeholder="e.g. 600"
                      className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                      Supplier Name
                    </label>
                    <input
                      type="text"
                      value={stockForm.supplier}
                      onChange={(e) => setStockForm({ ...stockForm, supplier: e.target.value })}
                      placeholder="e.g. Fresh Bakery"
                      className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Reason for Removal *
                  </label>
                  <select
                    value={stockForm.reason}
                    onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs font-bold text-stone-900 dark:text-white"
                  >
                    <option value="Used">Used</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Expired">Expired</option>
                    <option value="Wasted">Wasted</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={stockForm.date}
                  onChange={(e) => setStockForm({ ...stockForm, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={stockForm.notes}
                  onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
                  placeholder="e.g. Batch #4"
                  className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 dark:border-white/5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStockModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-xs"
                >
                  {stockActionType === "add" ? "Add Stock" : "Remove Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ADD / EDIT INGREDIENT MODAL                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {ingredientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/5">
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                {editingIngredient ? "Edit Ingredient" : "Add Ingredient"}
              </h3>
              <button onClick={() => setIngredientModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Ingredient Name *
                </label>
                <input
                  type="text"
                  required
                  value={ingredientForm.name}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                  placeholder="e.g. Burger Bun"
                  className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Unit *
                  </label>
                  <select
                    value={ingredientForm.unit}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white font-semibold"
                  >
                    <option value="pieces">Pieces</option>
                    <option value="kg">Kg</option>
                    <option value="grams">Grams</option>
                    <option value="litres">Litres</option>
                    <option value="ml">Ml</option>
                    <option value="bottles">Bottles</option>
                    <option value="packets">Packets</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={ingredientForm.currentStock}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, currentStock: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Minimum Stock (Alert Level)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={ingredientForm.minimumStock}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, minimumStock: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Cost Per Unit (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={ingredientForm.costPerUnit}
                    onChange={(e) => setIngredientForm({ ...ingredientForm, costPerUnit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Supplier (Optional)
                </label>
                <select
                  value={ingredientForm.supplier}
                  onChange={(e) => setIngredientForm({ ...ingredientForm, supplier: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white"
                >
                  <option value="">No Supplier Selected</option>
                  {suppliers.map((sup) => (
                    <option key={sup._id} value={sup._id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-stone-100 dark:border-white/5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIngredientModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-xs"
                >
                  {editingIngredient ? "Save Changes" : "Add Ingredient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* NEW PURCHASE MODAL                                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {purchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/5">
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                Record New Purchase
              </h3>
              <button onClick={() => setPurchaseModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={purchaseForm.supplierName}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierName: e.target.value })}
                    placeholder="e.g. Fresh Bakery"
                    className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={purchaseForm.date}
                    onChange={(e) => setPurchaseForm({ ...purchaseForm, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs text-stone-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-stone-700 dark:text-stone-300">
                    Purchased Ingredients *
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setPurchaseForm({
                        ...purchaseForm,
                        items: [
                          ...purchaseForm.items,
                          {
                            ingredient: ingredients[0]?._id || "",
                            name: ingredients[0]?.name || "",
                            quantity: 1,
                            unit: ingredients[0]?.unit || "pieces",
                            unitCost: 0,
                            totalCost: 0,
                          },
                        ],
                      })
                    }
                    className="text-orange-600 font-bold hover:underline"
                  >
                    + Add Item
                  </button>
                </div>

                {purchaseForm.items.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/80 dark:border-white/5 grid grid-cols-12 gap-2 items-center"
                  >
                    <div className="col-span-5">
                      <select
                        value={item.ingredient}
                        onChange={(e) => {
                          const selected = ingredients.find((i) => i._id === e.target.value);
                          const newItems = [...purchaseForm.items];
                          newItems[index] = {
                            ...item,
                            ingredient: e.target.value,
                            name: selected ? selected.name : item.name,
                            unit: selected ? selected.unit : item.unit,
                            unitCost: selected?.costPerUnit || item.unitCost,
                            totalCost: (selected?.costPerUnit || item.unitCost) * item.quantity,
                          };
                          setPurchaseForm({ ...purchaseForm, items: newItems });
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-white/10 border border-stone-200 dark:border-white/10 text-xs"
                      >
                        {ingredients.map((ing) => (
                          <option key={ing._id} value={ing._id}>
                            {ing.name} ({ing.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...purchaseForm.items];
                          newItems[index].quantity = Number(e.target.value);
                          newItems[index].totalCost = Number(e.target.value) * item.unitCost;
                          setPurchaseForm({ ...purchaseForm, items: newItems });
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-white/10 border border-stone-200 dark:border-white/10 text-xs"
                      />
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="₹ Unit"
                        value={item.unitCost}
                        onChange={(e) => {
                          const newItems = [...purchaseForm.items];
                          newItems[index].unitCost = Number(e.target.value);
                          newItems[index].totalCost = Number(e.target.value) * item.quantity;
                          setPurchaseForm({ ...purchaseForm, items: newItems });
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-white/10 border border-stone-200 dark:border-white/10 text-xs"
                      />
                    </div>

                    <div className="col-span-1 text-right">
                      {purchaseForm.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = purchaseForm.items.filter((_, i) => i !== index);
                            setPurchaseForm({ ...purchaseForm, items: newItems });
                          }}
                          className="text-stone-400 hover:text-rose-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-between font-bold text-sm">
                <span>Total Bill Amount:</span>
                <span className="text-orange-600">
                  ₹
                  {purchaseForm.items
                    .reduce((acc, curr) => acc + (curr.totalCost || 0), 0)
                    .toLocaleString()}
                </span>
              </div>

              <div className="pt-3 border-t border-stone-100 dark:border-white/5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPurchaseModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-xs"
                >
                  Save & Increase Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* VIEW PURCHASE DETAIL MODAL                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/5">
              <div>
                <span className="text-[10px] text-stone-400 font-bold uppercase">Purchase Invoice</span>
                <h3 className="text-base font-black text-stone-900 dark:text-white">
                  {viewingPurchase.supplierName}
                </h3>
              </div>
              <button onClick={() => setViewingPurchase(null)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-stone-400">
                <span>Date:</span>
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                  {new Date(viewingPurchase.date).toLocaleDateString()}
                </span>
              </div>

              <div className="divide-y divide-stone-100 dark:divide-white/5 pt-2">
                {viewingPurchase.items?.map((item, idx) => (
                  <div key={idx} className="py-2 flex justify-between">
                    <div>
                      <span className="font-bold text-stone-900 dark:text-white block">{item.name}</span>
                      <span className="text-stone-400 text-[11px]">
                        {item.quantity} {item.unit} × ₹{item.unitCost}
                      </span>
                    </div>
                    <span className="font-bold">₹{item.totalCost}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t flex justify-between font-black text-sm">
                <span>Total:</span>
                <span>₹{(viewingPurchase.totalAmount || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* RECORD WASTE MODAL                                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {wasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/5">
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                Record Ingredient Waste
              </h3>
              <button onClick={() => setWasteModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveWaste} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Ingredient *
                </label>
                <select
                  required
                  value={wasteForm.ingredient}
                  onChange={(e) => setWasteForm({ ...wasteForm, ingredient: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs font-semibold"
                >
                  <option value="">Select ingredient...</option>
                  {ingredients.map((ing) => (
                    <option key={ing._id} value={ing._id}>
                      {ing.name} (Current: {ing.currentStock} {ing.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Wasted Quantity *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={wasteForm.quantity}
                    onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })}
                    placeholder="e.g. 2"
                    className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Reason *
                  </label>
                  <select
                    value={wasteForm.reason}
                    onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs font-semibold"
                  >
                    <option value="Spoiled">Spoiled</option>
                    <option value="Expired">Expired</option>
                    <option value="Damaged">Damaged</option>
                    <option value="Over-prepared">Over-prepared</option>
                    <option value="Spilled">Spilled</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={wasteForm.notes}
                  onChange={(e) => setWasteForm({ ...wasteForm, notes: e.target.value })}
                  placeholder="e.g. Freezer power outage"
                  className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 dark:border-white/5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setWasteModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
                >
                  Record & Reduce Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ADD / EDIT SUPPLIER MODAL                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/5">
              <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                {editingSupplier ? "Edit Supplier" : "Add Supplier"}
              </h3>
              <button onClick={() => setSupplierModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  placeholder="e.g. Fresh Bakery"
                  className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    placeholder="98XXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                    WhatsApp (Optional)
                  </label>
                  <input
                    type="tel"
                    value={supplierForm.whatsapp}
                    onChange={(e) => setSupplierForm({ ...supplierForm, whatsapp: e.target.value })}
                    placeholder="WhatsApp number"
                    className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Items Provided
                </label>
                <input
                  type="text"
                  value={supplierForm.items}
                  onChange={(e) => setSupplierForm({ ...supplierForm, items: e.target.value })}
                  placeholder="e.g. Burger Buns, Sandwich Bread"
                  className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Address (Optional)
                </label>
                <input
                  type="text"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  placeholder="Street / Market location"
                  className="w-full px-3 py-2 rounded-xl bg-stone-100 dark:bg-white/5 border border-stone-200 dark:border-white/10 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 dark:border-white/5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSupplierModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-xs"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* RECIPE BUILDER MODAL (Connect Dish to Ingredients)            */}
      {/* ───────────────────────────────────────────────────────────── */}
      {recipeModalOpen && selectedProductRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#121624] border border-stone-200 dark:border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-white/5">
              <div>
                <span className="text-[10px] text-orange-500 font-bold uppercase">Recipe Setup</span>
                <h3 className="text-base font-black text-stone-900 dark:text-white">
                  {selectedProductRecipe.name}
                </h3>
              </div>
              <button onClick={() => setRecipeModalOpen(false)} className="text-stone-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRecipe} className="space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-stone-700 dark:text-stone-300">
                  Ingredients used in 1 order:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setRecipeFormItems([
                      ...recipeFormItems,
                      {
                        ingredient: ingredients[0]?._id || "",
                        ingredientName: ingredients[0]?.name || "",
                        quantity: 1,
                        unit: ingredients[0]?.unit || "pieces",
                      },
                    ])
                  }
                  className="text-orange-600 font-bold hover:underline"
                >
                  + Add Ingredient
                </button>
              </div>

              {recipeFormItems.map((item, index) => (
                <div
                  key={index}
                  className="p-3 rounded-xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/80 dark:border-white/5 grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-6">
                    <select
                      value={item.ingredient}
                      onChange={(e) => {
                        const sel = ingredients.find((i) => i._id === e.target.value);
                        const newItems = [...recipeFormItems];
                        newItems[index] = {
                          ...item,
                          ingredient: e.target.value,
                          ingredientName: sel ? sel.name : item.ingredientName,
                          unit: sel ? sel.unit : item.unit,
                        };
                        setRecipeFormItems(newItems);
                      }}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-white/10 border border-stone-200 dark:border-white/10 text-xs"
                    >
                      <option value="">Select ingredient...</option>
                      {ingredients.map((ing) => (
                        <option key={ing._id} value={ing._id}>
                          {ing.name} ({ing.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-5 flex items-center gap-1">
                    <input
                      type="number"
                      min="0.001"
                      step="any"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...recipeFormItems];
                        newItems[index].quantity = Number(e.target.value);
                        setRecipeFormItems(newItems);
                      }}
                      className="w-16 px-2 py-1.5 rounded-lg bg-white dark:bg-white/10 border border-stone-200 dark:border-white/10 text-xs font-bold text-center"
                    />
                    <span className="text-[11px] text-stone-500 font-semibold truncate">
                      {item.unit}
                    </span>
                  </div>

                  <div className="col-span-1 text-right">
                    {recipeFormItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setRecipeFormItems(recipeFormItems.filter((_, i) => i !== index));
                        }}
                        className="text-stone-400 hover:text-rose-500"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t border-stone-100 dark:border-white/5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecipeModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-stone-100 dark:bg-white/5 text-stone-700 dark:text-stone-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-xs"
                >
                  Save Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
