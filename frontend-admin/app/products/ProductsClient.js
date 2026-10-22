"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
import toast from "react-hot-toast";
import Tooltip, { HelpTooltip } from "@/components/ui/Tooltip";
import {
  UtensilsCrossed,
  PlusCircle,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  X,
  ToggleLeft,
  ToggleRight,
  Upload,
  Image as ImageIcon,
  Clock,
  Sparkles,
  FolderTree,
  Check,
  Globe,
  Building,
  Pencil,
} from "lucide-react";

export const PRESET_FOOD_PHOTOS = [
  { label: "Burgers", url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80", icon: "🍔" },
  { label: "Pizza", url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80", icon: "🍕" },
  { label: "Fries & Sides", url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&auto=format&fit=crop&q=80", icon: "🍟" },
  { label: "Cold Drinks", url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80", icon: "🥤" },
  { label: "Momos & Dumplings", url: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&auto=format&fit=crop&q=80", icon: "🥟" },
  { label: "Soups", url: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80", icon: "🍲" },
  { label: "Desserts & Shakes", url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&auto=format&fit=crop&q=80", icon: "🍰" },
  { label: "Biryani & Rice", url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80", icon: "🍛" },
  { label: "Pasta & Noodles", url: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80", icon: "🍜" },
  { label: "Sandwiches & Wraps", url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80", icon: "🥪" },
  { label: "Salads & Greens", url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80", icon: "🥗" },
  { label: "Coffee & Tea", url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80", icon: "☕" },
];

export const PORTION_UNITS = [
  { value: "piece", label: "Piece / Pieces" },
  { value: "plate", label: "Plate" },
  { value: "bowl", label: "Bowl" },
  { value: "serving", label: "Serving" },
  { value: "g", label: "Gram (g)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "ml", label: "Millilitre (ml)" },
  { value: "l", label: "Litre (L)" },
  { value: "slice", label: "Slice" },
  { value: "custom", label: "Other / Custom" },
];

export function getPortionPreviewText(price, portion, hasVariants, variants) {
  if (hasVariants && Array.isArray(variants) && variants.length > 0) {
    const validPrices = variants.map((v) => Number(v.price)).filter((p) => !isNaN(p) && p >= 0);
    const minP = validPrices.length > 0 ? Math.min(...validPrices) : price;
    const maxP = validPrices.length > 0 ? Math.max(...validPrices) : price;
    const priceText = minP === maxP ? `₹${minP || 0}` : `₹${minP} – ₹${maxP}`;
    const variantSummaries = variants
      .map((v) => {
        if (!v.name) return "";
        const portionTxt = v.servingLabel || (v.portionQuantity ? `${v.portionQuantity} ${v.portionUnit || ""}`.trim() : "");
        return portionTxt ? `${v.name} (${portionTxt})` : v.name;
      })
      .filter(Boolean)
      .join(" · ");
    return `${priceText} · ${variantSummaries || `${variants.length} sizes available`}`;
  }

  const p = price !== "" && price !== undefined && !isNaN(Number(price)) ? `₹${price}` : "₹—";
  if (!portion) return p;

  const q = portion.quantity !== "" && portion.quantity !== null && portion.quantity !== undefined
    ? portion.quantity
    : "";
  const u = portion.unit === "custom"
    ? portion.customUnit || ""
    : portion.unit || "";
  const label = portion.servingLabel ? portion.servingLabel.trim() : "";
  const size = portion.size ? portion.size.trim() : "";

  let portionPart = "";
  if (q && u) {
    portionPart = `${q} ${u}`;
  } else if (u) {
    portionPart = u;
  }

  if (label) {
    portionPart = portionPart ? `${portionPart} (${label})` : label;
  }
  if (size) {
    portionPart = portionPart ? `${portionPart} · ${size}` : size;
  }

  return portionPart ? `${p} · ${portionPart}` : p;
}

export function getProductFallbackImage(product) {
  const cat = (product?.category || "").toLowerCase();
  const name = (product?.name || "").toLowerCase();

  if (
    name.includes("gulab") ||
    name.includes("jamun") ||
    name.includes("sweet") ||
    name.includes("dessert") ||
    cat.includes("dessert") ||
    cat.includes("gulab") ||
    cat.includes("sweet")
  ) {
    return "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=800&auto=format&fit=crop&q=80";
  }
  if (name.includes("soup") || cat.includes("soup")) {
    return "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop&q=80";
  }
  if (name.includes("burger") || cat.includes("burger")) {
    return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80";
  }
  if (name.includes("pizza") || cat.includes("pizza")) {
    return "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80";
  }
  if (name.includes("fries") || name.includes("finger") || cat.includes("fries") || cat.includes("sides")) {
    return "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&auto=format&fit=crop&q=80";
  }
  if (name.includes("cold drink") || name.includes("beverage") || name.includes("shake") || name.includes("drink") || cat.includes("drink")) {
    return "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=800&auto=format&fit=crop&q=80";
  }
  if (name.includes("momo") || name.includes("dumpling") || cat.includes("momo")) {
    return "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&auto=format&fit=crop&q=80";
  }
  if (name.includes("biryani") || name.includes("rice") || cat.includes("biryani") || cat.includes("rice")) {
    return "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80";
  }
  if (name.includes("noodle") || name.includes("pasta") || cat.includes("pasta") || cat.includes("noodle")) {
    return "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80";
  }
  if (name.includes("sandwich") || name.includes("wrap") || cat.includes("sandwich") || cat.includes("wrap")) {
    return "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80";
  }
  if (name.includes("salad") || cat.includes("salad")) {
    return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80";
  }
  if (name.includes("coffee") || name.includes("tea") || cat.includes("coffee") || cat.includes("tea")) {
    return "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80";
  }
  return "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80";
}

function DishThumbnail({ src, alt, product, fill = false, className = "" }) {
  const fallbackSrc = useMemo(() => getProductFallbackImage(product), [product]);
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc);
    setHasError(false);
  }, [src, fallbackSrc]);

  const isExternal = Boolean(
    currentSrc && (currentSrc.startsWith("http://") || currentSrc.startsWith("https://"))
  );

  return (
    <NextImage
      src={currentSrc}
      alt={alt || product?.name || "Dish image"}
      fill={fill}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className={className}
      unoptimized={isExternal}
      onError={() => {
        if (!hasError && currentSrc !== fallbackSrc) {
          setHasError(true);
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}

export default function ProductsClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // View state: 'dishes' | 'categories'
  const [viewTab, setViewTab] = useState("dishes");

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Dynamic restaurant-launched categories
  const [launchedCategories, setLaunchedCategories] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");

  // New Category Modal States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: "",
    icon: "🍽️",
    description: "",
    image: "",
  });
  const [newCatImageTab, setNewCatImageTab] = useState("upload"); // 'upload' | 'preset' | 'url'
  const newCatFileInputRef = useRef(null);
  const [launchingCategory, setLaunchingCategory] = useState(false);

  // Edit Category Modal States
  const [editingCategory, setEditingCategory] = useState(null);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editCategoryForm, setEditCategoryForm] = useState({
    _id: "",
    name: "",
    icon: "🍽️",
    description: "",
    image: "",
  });
  const [editCatImageTab, setEditCatImageTab] = useState("upload");
  const editCatFileInputRef = useRef(null);
  const [savingCategory, setSavingCategory] = useState(false);

  // Dynamically compute all categories from restaurant launches and products
  const allCategories = useMemo(() => {
    const fromLaunches = launchedCategories.map((c) => c.name?.trim()).filter(Boolean);
    const fromProducts = products.map((p) => p.category?.trim()).filter(Boolean);
    const combined = Array.from(new Set([...fromLaunches, ...fromProducts]));
    return ["All", ...combined];
  }, [launchedCategories, products]);

  const selectableCategories = useMemo(() => {
    const list = allCategories.filter((c) => c !== "All");
    return [...list, "Other"];
  }, [allCategories]);

  // Group products by category for detailed restaurant view
  const productsByCategory = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      const cat = p.category?.trim() || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    });
    return map;
  }, [products]);

  // Filtered categories for category tab
  const filteredCategoriesList = useMemo(() => {
    if (!categorySearch.trim()) return launchedCategories;
    const q = categorySearch.toLowerCase().trim();
    return launchedCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [launchedCategories, categorySearch]);

  // Modal State for Add / Edit Product
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [modalForm, setModalForm] = useState({
    _id: "",
    name: "",
    description: "",
    price: "",
    image: "",
    category: "Other",
    customCategory: "",
    type: "veg",
    preparationTime: 15,
    isAvailable: true,
    isFeatured: false,
    portion: {
      quantity: "",
      unit: "piece",
      customUnit: "",
      servingLabel: "",
      size: "",
    },
    hasVariants: false,
    variants: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageMode, setImageMode] = useState("file"); // "file" | "url"
  const fileInputRef = useRef(null);

  // Route protection
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  async function safeParseJson(res) {
    try {
      if (!res || !res.ok) return { success: false, message: `Server status: ${res?.status || "network"}` };
      const text = await res.text();
      return JSON.parse(text);
    } catch {
      return { success: false, message: "Server is compiling or temporarily busy." };
    }
  }

  async function loadProducts() {
    try {
      setLoading(true);
      const res = await fetch("/api/restaurant/products");
      const data = await safeParseJson(res);
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch("/api/categories");
      const data = await safeParseJson(res);
      if (data.success && Array.isArray(data.categories)) {
        setLaunchedCategories(data.categories);
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }

  useEffect(() => {
    if (session?.user) {
      loadProducts();
      loadCategories();
    }
  }, [session]);

  // Client-side downscale and compression helper for category images
  function processCategoryImage(file, callback) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image exceeds 8MB. Please choose a smaller photo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1000;
        const maxHeight = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

        callback(dataUrl);
        toast.success("Category photo selected & optimized!");
      };
      img.onerror = () => {
        toast.error("Invalid image file format.");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Launch new category handler
  async function handleLaunchCategory(e) {
    e.preventDefault();
    const catName = newCategoryForm.name.trim();
    if (!catName) {
      toast.error("Category name is required.");
      return;
    }

    try {
      setLaunchingCategory(true);
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catName,
          icon: newCategoryForm.icon || "🍽️",
          description: newCategoryForm.description || "",
          image: newCategoryForm.image || "",
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Category "${catName}" launched successfully! Live on menu & category filters.`);
        setNewCategoryForm({ name: "", icon: "🍽️", description: "", image: "" });
        setIsCategoryModalOpen(false);
        await loadCategories();
      } else {
        toast.error(data.message || "Failed to launch category.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error launching category.");
    } finally {
      setLaunchingCategory(false);
    }
  }

  // Variant row management helpers for Add / Edit dish form
  function handleAddVariantRow() {
    setModalForm((prev) => ({
      ...prev,
      variants: [
        ...(prev.variants || []),
        {
          id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: "",
          price: "",
          portionQuantity: "",
          portionUnit: prev.portion?.unit || "piece",
          servingLabel: "",
          size: "",
          isAvailable: true,
        },
      ],
    }));
  }

  function handleUpdateVariantRow(index, field, value) {
    setModalForm((prev) => {
      const updated = [...(prev.variants || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, variants: updated };
    });
  }

  function handleRemoveVariantRow(index) {
    setModalForm((prev) => {
      const updated = (prev.variants || []).filter((_, i) => i !== index);
      return { ...prev, variants: updated };
    });
  }

  // Open Edit Category Modal
  function handleOpenEditCategory(cat) {
    setEditingCategory(cat);
    setEditCategoryForm({
      _id: cat._id,
      name: cat.name,
      icon: cat.icon || "🍽️",
      description: cat.description || "",
      image: cat.image || "",
    });
    setEditCatImageTab(cat.image ? "upload" : "preset");
    setIsEditCategoryModalOpen(true);
  }

  // Save Category Updates
  async function handleUpdateCategory(e) {
    e.preventDefault();
    if (!editCategoryForm.name?.trim()) {
      toast.error("Category name is required.");
      return;
    }

    try {
      setSavingCategory(true);
      const res = await fetch(`/api/categories/${editCategoryForm._id || editCategoryForm.name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editCategoryForm.name.trim(),
          icon: editCategoryForm.icon || "🍽️",
          description: editCategoryForm.description || "",
          image: editCategoryForm.image || "",
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Category "${editCategoryForm.name}" updated successfully!`);
        setIsEditCategoryModalOpen(false);
        setEditingCategory(null);
        await loadCategories();
        await loadProducts();
      } else {
        toast.error(data.message || "Failed to update category.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error updating category.");
    } finally {
      setSavingCategory(false);
    }
  }

  // Pre-fill Add Dish modal with category
  function handleAddDishToCategory(categoryName) {
    setIsEditing(false);
    setImageMode("preset");
    const defaultImg = getProductFallbackImage({ category: categoryName, name: "" });
    setModalForm({
      _id: "",
      name: "",
      description: "",
      price: "",
      image: defaultImg,
      category: categoryName || "Other",
      customCategory: "",
      type: "veg",
      preparationTime: 15,
      isAvailable: true,
      isFeatured: false,
      portion: {
        quantity: "",
        unit: "piece",
        customUnit: "",
        servingLabel: "",
        size: "",
      },
      hasVariants: false,
      variants: [],
    });
    setIsModalOpen(true);
  }

  // Open modal for new product
  function openAddModal() {
    setIsEditing(false);
    setImageMode("preset");
    const initialCat = selectableCategories.length > 1 ? selectableCategories[0] : "Other";
    const defaultImg = getProductFallbackImage({ category: initialCat, name: "" });
    setModalForm({
      _id: "",
      name: "",
      description: "",
      price: "",
      image: defaultImg,
      category: initialCat,
      customCategory: "",
      type: "veg",
      preparationTime: 15,
      isAvailable: true,
      isFeatured: false,
      portion: {
        quantity: "",
        unit: "piece",
        customUnit: "",
        servingLabel: "",
        size: "",
      },
      hasVariants: false,
      variants: [],
    });
    setIsModalOpen(true);
  }

  // Open modal for editing existing product
  function openEditModal(product) {
    setIsEditing(true);
    const isPreset = PRESET_FOOD_PHOTOS.some((p) => p.url === product.image);
    if (isPreset) {
      setImageMode("preset");
    } else if (product.image?.startsWith("http")) {
      setImageMode("url");
    } else {
      setImageMode("file");
    }
    const isExisting = selectableCategories.filter((c) => c !== "Other").includes(product.category);

    const existingPortion = product.portion || {
      quantity: "",
      unit: "piece",
      customUnit: "",
      servingLabel: "",
      size: "",
    };

    const existingVariants = Array.isArray(product.variants)
      ? product.variants.map((v, i) => ({
          id: v._id || `var_${i}_${Date.now()}`,
          name: v.name || "",
          price: v.price !== undefined ? v.price : "",
          portionQuantity: v.portionQuantity !== undefined && v.portionQuantity !== null ? v.portionQuantity : "",
          portionUnit: v.portionUnit || "piece",
          servingLabel: v.servingLabel || "",
          size: v.size || "",
          isAvailable: v.isAvailable !== false,
        }))
      : [];

    setModalForm({
      _id: product._id,
      name: product.name,
      description: product.description || "",
      price: product.price,
      image: product.image,
      category: isExisting ? product.category : "Other",
      customCategory: isExisting ? "" : (product.category || ""),
      type: product.type || "veg",
      preparationTime: product.preparationTime || 15,
      isAvailable: product.isAvailable !== false,
      isFeatured: !!product.isFeatured,
      portion: {
        quantity: existingPortion.quantity !== null && existingPortion.quantity !== undefined ? existingPortion.quantity : "",
        unit: existingPortion.unit || "piece",
        customUnit: existingPortion.customUnit || "",
        servingLabel: existingPortion.servingLabel || "",
        size: existingPortion.size || "",
      },
      hasVariants: Boolean(product.hasVariants && existingVariants.length > 0),
      variants: existingVariants,
    });
    setIsModalOpen(true);
  }

  // Handle image upload from device for product
  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are allowed.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image exceeds 5 MB limit. Please select a smaller photo.");
      return;
    }

    try {
      setUploadingImage(true);
      const localPreview = URL.createObjectURL(file);
      setModalForm((prev) => ({ ...prev, image: localPreview }));

      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/restaurant/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.imageUrl) {
        setModalForm((prev) => ({ ...prev, image: data.imageUrl }));
        toast.success("Dish photo uploaded from device successfully!");
      } else {
        toast.error(data.message || "Failed to upload image.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error uploading image from device.");
    } finally {
      setUploadingImage(false);
    }
  }

  // Submit Product Add or Edit
  async function handleSubmitProduct(e) {
    e.preventDefault();
    try {
      setSubmitting(true);

      const finalCategory = modalForm.category === "Other"
        ? modalForm.customCategory.trim()
        : modalForm.category;

      if (modalForm.category === "Other" && !finalCategory) {
        toast.error("Please specify the custom category name.");
        setSubmitting(false);
        return;
      }

      const defaultImage = getProductFallbackImage({ category: finalCategory, name: modalForm.name });

      const hasVariants = Boolean(modalForm.hasVariants);
      let variantsPayload = [];
      if (hasVariants) {
        if (!Array.isArray(modalForm.variants) || modalForm.variants.length === 0) {
          toast.error("Please add at least one variant or disable multiple sizes.");
          setSubmitting(false);
          return;
        }
        for (const v of modalForm.variants) {
          if (!v.name?.trim()) {
            toast.error("Each variant must have a name (e.g. Small, Medium, Large).");
            setSubmitting(false);
            return;
          }
          if (v.price === "" || isNaN(Number(v.price)) || Number(v.price) < 0) {
            toast.error(`Please provide a valid price for variant "${v.name}".`);
            setSubmitting(false);
            return;
          }
          variantsPayload.push({
            name: v.name.trim(),
            price: Number(v.price),
            portionQuantity: v.portionQuantity !== "" && v.portionQuantity !== null ? Number(v.portionQuantity) : null,
            portionUnit: v.portionUnit ? v.portionUnit.trim() : null,
            servingLabel: v.servingLabel ? v.servingLabel.trim() : null,
            size: v.size ? v.size.trim() : null,
            isAvailable: v.isAvailable !== false,
          });
        }
      }

      const portionObj = modalForm.portion || {};
      const hasPortionData =
        (portionObj.quantity !== "" && portionObj.quantity !== null && portionObj.quantity !== undefined) ||
        (portionObj.servingLabel && portionObj.servingLabel.trim()) ||
        (portionObj.size && portionObj.size.trim());

      const portionPayload = hasPortionData
        ? {
            quantity: portionObj.quantity !== "" && portionObj.quantity !== null ? Number(portionObj.quantity) : null,
            unit: portionObj.unit === "custom" ? (portionObj.customUnit?.trim() || "unit") : (portionObj.unit || "piece"),
            customUnit: portionObj.customUnit?.trim() || null,
            servingLabel: portionObj.servingLabel?.trim() || null,
            size: portionObj.size?.trim() || null,
          }
        : null;

      const payload = {
        name: modalForm.name.trim(),
        description: modalForm.description?.trim() || "",
        price: Number(modalForm.price),
        image: modalForm.image?.trim() || defaultImage,
        category: finalCategory,
        type: modalForm.type,
        preparationTime: Number(modalForm.preparationTime) || 15,
        isAvailable: modalForm.isAvailable !== false,
        isFeatured: Boolean(modalForm.isFeatured),
        portion: portionPayload,
        hasVariants,
        variants: variantsPayload,
      };

      const url = isEditing
        ? `/api/restaurant/products/${modalForm._id}`
        : "/api/restaurant/products";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Failed to save product.");
        return;
      }

      toast.success(
        isEditing
          ? `Product "${payload.name}" updated successfully!`
          : `Product "${payload.name}" created and added to your menu!`
      );

      setIsModalOpen(false);
      await loadProducts();
      await loadCategories();
    } catch (err) {
      console.error(err);
      toast.error("Error saving product.");
    } finally {
      setSubmitting(false);
    }
  }

  // Quick toggle product availability
  async function handleToggleAvailability(product) {
    try {
      const newAvailability = !product.isAvailable;
      const res = await fetch(`/api/restaurant/products/${product._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: newAvailability }),
      });
      const data = await res.json();
      if (data.success) {
        setProducts((prev) =>
          prev.map((p) => (p._id === product._id ? { ...p, isAvailable: newAvailability } : p))
        );
        toast.success(`"${product.name}" is now marked as ${newAvailability ? "AVAILABLE" : "OUT OF STOCK"}.`);
      } else {
        toast.error(data.message || "Failed to update availability.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update availability.");
    }
  }

  // Delete Product
  async function handleDeleteProduct(product) {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete "${product.name}" from your restaurant menu?`
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/restaurant/products/${product._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Deleted "${product.name}" successfully.`);
        setProducts((prev) => prev.filter((p) => p._id !== product._id));
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete product.");
    }
  }

  // Filter products for dishes tab
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-jakarta">
        {/* Header with Title and Mode Switcher */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 border-b border-stone-200/80 dark:border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider">
                Kitchen Management
              </span>
              <span className="text-stone-300 dark:text-stone-700">•</span>
              <span className="text-stone-500 text-xs font-medium">
                {viewTab === "dishes" ? "Menu Items & Availability" : "Category Taxonomy & Photos"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white mt-1">
              {viewTab === "dishes" ? (
                <>Restaurant <span className="text-orange-500">Dishes</span></>
              ) : (
                <>Category <span className="text-orange-500">Taxonomy</span></>
              )}
            </h1>
            <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
              {viewTab === "dishes"
                ? "Add dishes, update pricing, and toggle instant availability for customers."
                : "Manage kitchen category cover photos, view grouped dishes, and launch new categories."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Switcher: Dishes vs Categories */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-white/5 border border-stone-200/80 dark:border-white/10 rounded-2xl shadow-xs">
              <Tooltip content="Show all dishes in a searchable card grid" position="bottom">
                <button
                  type="button"
                  onClick={() => setViewTab("dishes")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                    viewTab === "dishes"
                      ? "bg-white dark:bg-stone-800 text-orange-600 dark:text-orange-400 shadow-xs"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                  }`}
                >
                  <UtensilsCrossed size={14} />
                  <span>Dishes ({products.length})</span>
                </button>
              </Tooltip>
              <Tooltip content="Organize dishes grouped under menu categories" position="bottom">
                <button
                  type="button"
                  onClick={() => setViewTab("categories")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                    viewTab === "categories"
                      ? "bg-white dark:bg-stone-800 text-orange-600 dark:text-orange-400 shadow-xs"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
                  }`}
                >
                  <FolderTree size={14} />
                  <span>Categories ({launchedCategories.length})</span>
                </button>
              </Tooltip>
            </div>

            <Tooltip content="Create a new food category to organize dishes on your customer menu" position="bottom">
              <button
                type="button"
                onClick={() => {
                  setNewCategoryForm({ name: "", icon: "🍽️", description: "", image: "" });
                  setIsCategoryModalOpen(true);
                }}
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition text-stone-950 font-extrabold px-4 py-2.5 rounded-xl text-xs uppercase tracking-wider shadow-md shadow-amber-500/25 active:scale-95 cursor-pointer"
              >
                <Sparkles size={16} className="text-stone-950" />
                <span>Launch Category</span>
              </button>
            </Tooltip>

            <Tooltip content="Add a new dish with photos, pricing, prep time, and dietary tags" position="bottom">
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 transition text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-orange-500/20 active:scale-95 cursor-pointer"
              >
                <PlusCircle size={18} /> Add Dish
              </button>
            </Tooltip>
          </div>
        </div>


        {/* ── CONDITIONAL VIEW RENDER: CATEGORIES vs DISHES ──────── */}
        {viewTab === "categories" ? (
          /* ── DETAILED RESTAURANT CATEGORY VIEW ───────────────────── */
          <div className="space-y-6">
            {/* Kitchen Category Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-white/90 dark:bg-[#10141f]/90 p-4 rounded-2xl border border-stone-200/90 dark:border-white/10 shadow-xs">
                <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider block">
                  Active Categories
                </span>
                <span className="text-2xl font-bold text-stone-900 dark:text-white mt-1 block">
                  {launchedCategories.length}
                </span>
                <span className="text-[10px] text-stone-400 mt-1 block">Catalog taxonomy</span>
              </div>

              <div className="bg-white/90 dark:bg-[#10141f]/90 p-4 rounded-2xl border border-stone-200/90 dark:border-white/10 shadow-xs">
                <span className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider block">
                  Kitchen Dishes
                </span>
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1 block">
                  {products.length}
                </span>
                <span className="text-[10px] text-stone-400 mt-1 block">Classified menu items</span>
              </div>

              <div className="bg-white/90 dark:bg-[#10141f]/90 p-4 rounded-2xl border border-stone-200/90 dark:border-white/10 shadow-xs">
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  In Stock Items
                </span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {products.filter((p) => p.isAvailable).length}
                </span>
                <span className="text-[10px] text-stone-400 mt-1 block">Live for ordering</span>
              </div>

              <div className="bg-white/90 dark:bg-[#10141f]/90 p-4 rounded-2xl border border-stone-200/90 dark:border-white/10 shadow-xs">
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  Kitchen Custom
                </span>
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1 block">
                  {launchedCategories.filter((c) => c.restaurant && c.restaurantName !== "Platform-Wide").length}
                </span>
                <span className="text-[10px] text-stone-400 mt-1 block">Exclusive to your kitchen</span>
              </div>
            </div>

            {/* Category Search & Filter */}
            <div className="bg-white/90 dark:bg-[#10141f]/90 border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-2.5 text-stone-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Filter categories by name or description..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl pl-10 pr-8 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none"
                />
                {categorySearch && (
                  <button
                    type="button"
                    onClick={() => setCategorySearch("")}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <Tooltip content="Create a new food category to organize dishes on your customer menu" position="bottom">
                <button
                  type="button"
                  onClick={() => {
                    setNewCategoryForm({ name: "", icon: "🍽️", description: "", image: "" });
                    setIsCategoryModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 cursor-pointer shrink-0"
                >
                  <Sparkles size={14} />
                  <span>+ Launch Category</span>
                </button>
              </Tooltip>
            </div>

            {/* Detailed Category Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredCategoriesList.map((cat) => {
                const catDishes = productsByCategory[cat.name] || [];
                const isPlatform = !cat.restaurant || cat.restaurantName === "Platform-Wide";

                return (
                  <div
                    key={cat._id || cat.name}
                    className="bg-white/95 dark:bg-[#10141f]/95 border border-stone-200/90 dark:border-white/10 rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Cover Photo Header */}
                      <div className="relative h-40 w-full bg-stone-100 dark:bg-stone-800 overflow-hidden flex items-center justify-center">
                        {cat.image ? (
                          <img
                            src={cat.image}
                            alt={cat.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-orange-50 to-amber-100 dark:from-stone-800 dark:to-orange-950/20 flex items-center justify-center">
                            <span className="text-5xl">{cat.icon || "🍽️"}</span>
                          </div>
                        )}

                        {/* Category Icon Badge */}
                        <div className="absolute top-3 left-3 w-11 h-11 rounded-2xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-200/80 dark:border-stone-700/80 flex items-center justify-center text-2xl shadow-sm">
                          {cat.icon || "🍽️"}
                        </div>

                        {/* Scope Chip */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border backdrop-blur-md shadow-xs ${
                              isPlatform
                                ? "bg-indigo-500/20 text-indigo-900 dark:text-indigo-200 border-indigo-500/30"
                                : "bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/30"
                            }`}
                          >
                            {isPlatform ? "Universal Platform" : "Kitchen Custom"}
                          </span>
                        </div>

                        {/* Dish Count Pill */}
                        <div className="absolute bottom-2.5 right-3">
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-black/75 text-white backdrop-blur-md border border-white/15 flex items-center gap-1.5">
                            <UtensilsCrossed size={12} className="text-orange-400" />
                            <span>{catDishes.length} {catDishes.length === 1 ? "dish in kitchen" : "dishes in kitchen"}</span>
                          </span>
                        </div>
                      </div>

                      {/* Category Info */}
                      <div className="p-5 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
                              <span>{cat.name}</span>
                            </h3>
                            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                              {cat.description || "Fresh dishes prepared in this kitchen"}
                            </p>
                          </div>
                          <Tooltip content="Edit category title, cover image, and description" position="left">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCategory(cat)}
                              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-white/10 dark:hover:bg-white/15 text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0"
                              title="Edit category image and details"
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>
                          </Tooltip>
                        </div>

                        {/* Dishes Breakdown in this category */}
                        <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-white/5">
                          <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                            <span>Dishes in this Category ({catDishes.length})</span>
                            <Tooltip content={`Add a new dish pre-assigned to "${cat.name}"`} position="top">
                              <button
                                type="button"
                                onClick={() => handleAddDishToCategory(cat.name)}
                                className="text-orange-500 hover:text-orange-600 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                <PlusCircle size={13} /> Add Dish to Category
                              </button>
                            </Tooltip>
                          </div>

                          {catDishes.length > 0 ? (
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                              {catDishes.map((dish) => (
                                <div
                                  key={dish._id}
                                  className="flex items-center justify-between gap-3 p-2 rounded-xl bg-stone-50 dark:bg-white/5 border border-stone-200/60 dark:border-white/5 hover:border-orange-500/30 transition text-xs"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-stone-200 dark:bg-stone-800 shrink-0 relative">
                                      <DishThumbnail
                                        src={dish.image}
                                        alt={dish.name}
                                        product={dish}
                                        fill
                                        className="object-cover"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-bold text-stone-900 dark:text-white truncate">
                                        {dish.name}
                                      </div>
                                      <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                                        <span className="font-mono font-bold text-orange-600 dark:text-orange-400">₹{dish.price}</span>
                                        <span>•</span>
                                        <span className={dish.type === "veg" ? "text-emerald-600" : "text-red-500"}>
                                          {dish.type === "veg" ? "Veg" : "Non-Veg"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <Tooltip content={dish.isAvailable ? "Pause ordering (marks out of stock without deleting)" : "Resume ordering (marks in stock)"} position="top">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAvailability(dish)}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition ${
                                          dish.isAvailable
                                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                            : "bg-stone-500/10 text-stone-400 border border-stone-500/20"
                                        }`}
                                      >
                                        {dish.isAvailable ? "In Stock" : "Paused"}
                                      </button>
                                    </Tooltip>
                                    <Tooltip content="Edit dish pricing and details" position="left">
                                      <button
                                        type="button"
                                        onClick={() => openEditModal(dish)}
                                        className="p-1 rounded-lg hover:bg-stone-200 dark:hover:bg-white/10 text-stone-500 cursor-pointer"
                                        title="Edit dish"
                                      >
                                        <Edit2 size={12} />
                                      </button>
                                    </Tooltip>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl bg-stone-50 dark:bg-white/5 border border-dashed border-stone-200 dark:border-white/10 text-center">
                              <p className="text-xs text-stone-400">
                                No dishes currently mapped to &quot;{cat.name}&quot; in your kitchen.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleAddDishToCategory(cat.name)}
                                className="mt-2 text-xs font-bold text-orange-500 hover:text-orange-600 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <PlusCircle size={13} /> Add first dish
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── DISHES VIEW (ORIGINAL CATALOG) ───────────────────────── */
          <>
            {/* Filters and Search */}
            <div className="bg-white/90 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl p-4 mb-8 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm shadow-stone-200/40 dark:shadow-none">
              {/* Search */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-3 text-stone-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search dishes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-stone-900 dark:text-white placeholder-stone-400 dark:placeholder-stone-500 focus:border-orange-500 outline-none"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition active:scale-95 shrink-0 cursor-pointer ${
                      categoryFilter === cat
                        ? "bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-sm"
                        : "bg-stone-100 dark:bg-white/5 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white border border-stone-200/70 dark:border-white/5"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            {loading ? (
              <div className="py-20 flex justify-center text-orange-500">
                <RefreshCw className="animate-spin w-8 h-8" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-white/90 dark:bg-[#10141f]/90 backdrop-blur-md border border-stone-200/90 dark:border-white/10 rounded-2xl shadow-sm shadow-stone-200/40 dark:shadow-none">
                <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 text-stone-300 dark:text-stone-600" />
                <p className="text-base font-bold text-stone-800 dark:text-white">No dishes found</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Click &quot;Add Dish&quot; to add menu items.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <div
                    key={product._id}
                    className={`bg-white/95 dark:bg-[#10141f]/90 backdrop-blur-md border rounded-2xl overflow-hidden shadow-sm shadow-stone-200/40 dark:shadow-none hover:shadow-md transition flex flex-col justify-between ${
                      product.isAvailable
                        ? "border-stone-200/90 dark:border-white/10 hover:border-orange-500/40"
                        : "border-red-200 dark:border-red-500/20 opacity-75"
                    }`}
                  >
                    {/* Image and badges */}
                    <div className="relative h-48 w-full bg-stone-100 dark:bg-white/5 overflow-hidden group">
                      <DishThumbnail
                        src={product.image}
                        alt={product.name}
                        product={product}
                        fill
                        className="object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                        <Tooltip content={product.type === "veg" ? "Pure Vegetarian (Green Dot FSSAI compliant)" : "Non-Vegetarian (Red Dot FSSAI compliant)"} position="bottom">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border backdrop-blur-md cursor-help ${
                              product.type === "veg"
                                ? "bg-emerald-600/90 text-white border-emerald-400/50"
                                : "bg-red-600/90 text-white border-red-400/50"
                            }`}
                          >
                            {product.type}
                          </span>
                        </Tooltip>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/60 text-white backdrop-blur-md border border-white/10">
                          {product.category}
                        </span>
                        <Tooltip content="Estimated kitchen preparation & cooking time" position="bottom">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/70 text-amber-300 backdrop-blur-md border border-white/10 flex items-center gap-1 cursor-help">
                            <Clock size={10} /> {product.preparationTime || 15}m prep
                          </span>
                        </Tooltip>
                      </div>

                      <div className="absolute top-3 right-3">
                        <Tooltip content={product.isAvailable ? "Click to mark Out of Stock (86 dish). Preserves recipe, price, and photos." : "Click to mark In Stock and enable customer ordering."} position="left">
                          <button
                            onClick={() => handleToggleAvailability(product)}
                            className={`text-xs font-bold px-3 py-1 rounded-full shadow-xs transition flex items-center gap-1 active:scale-95 cursor-pointer ${
                              product.isAvailable
                                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                : "bg-stone-800 text-stone-200 hover:bg-stone-700"
                            }`}
                            title="Click to toggle availability"
                          >
                            {product.isAvailable ? "In Stock" : "Out of Stock"}
                          </button>
                        </Tooltip>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h3 className="font-bold text-stone-900 dark:text-white text-base">
                            {product.name}
                          </h3>
                          <span className="font-black text-lg text-orange-600 dark:text-orange-400 shrink-0">
                            {product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0
                              ? `From ₹${Math.min(...product.variants.map((v) => Number(v.price) || product.price))}`
                              : `₹${product.price}`}
                          </span>
                        </div>

                        {/* Transparent Portion / Variant Metadata Pill */}
                        {product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0 ? (
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            <span className="text-[10px] font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 px-2 py-0.5 rounded-lg flex items-center gap-1">
                              <span>🍕</span>
                              <span>{product.variants.length} Sizes</span>
                            </span>
                            <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium truncate max-w-[200px]">
                              {product.variants.map((v) => v.name).join(" · ")}
                            </span>
                          </div>
                        ) : product.portion?.servingLabel || (product.portion?.quantity && product.portion?.unit) ? (
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 bg-orange-500/10 border border-orange-500/25 px-2 py-0.5 rounded-lg flex items-center gap-1">
                              <span>⚖️</span>
                              <span>
                                {product.portion.servingLabel || `${product.portion.quantity} ${product.portion.unit}`}
                                {product.portion.size ? ` · ${product.portion.size}` : ""}
                              </span>
                            </span>
                          </div>
                        ) : null}
                        <p className="text-stone-500 dark:text-stone-400 text-xs line-clamp-2 leading-relaxed">
                          {product.description || "No description provided."}
                        </p>
                      </div>

                      <div className="pt-4 mt-4 border-t border-stone-100 dark:border-white/5 flex items-center justify-between text-xs">
                        <Tooltip content={product.isAvailable ? "This dish is visible on customer menus and can be ordered right now" : "This dish is temporarily hidden from ordering"} position="top">
                          <span
                            className={`inline-flex items-center gap-1 font-bold cursor-help ${
                              product.isAvailable ? "text-emerald-600" : "text-stone-400"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                product.isAvailable ? "bg-emerald-500 animate-pulse" : "bg-stone-400"
                              }`}
                            />
                            {product.isAvailable ? "Accepting Orders" : "Temporarily Paused"}
                          </span>
                        </Tooltip>

                        <div className="flex items-center gap-1">
                          <Tooltip content="Edit dish pricing, description, photo, prep time, and dietary options" position="top">
                            <button
                              onClick={() => openEditModal(product)}
                              className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-white/5 dark:hover:bg-white/10 text-stone-700 dark:text-stone-200 transition active:scale-95 cursor-pointer"
                              title="Edit dish details"
                            >
                              <Edit2 size={14} />
                            </button>
                          </Tooltip>
                          <Tooltip content="Permanently delete this dish from your restaurant menu. This cannot be undone." position="top">
                            <button
                              onClick={() => handleDeleteProduct(product)}
                              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 transition active:scale-95 cursor-pointer"
                              title="Delete dish"
                            >
                              <Trash2 size={14} />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ADD / EDIT PRODUCT MODAL ────────────────────────────── */}
        {isModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto"
          >
            <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-8">
              <div className="px-6 py-5 border-b border-stone-100 dark:border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                    {isEditing ? "Edit Dish Details" : "Add Dish to Kitchen Menu"}
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {isEditing ? "Modify pricing, photo and availability" : "Launch a new delicious item"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmitProduct} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Dish Name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Double Patty Smash Burger"
                    value={modalForm.name}
                    onChange={(e) => setModalForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none transition font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                        Price (₹) <span className="text-orange-500">*</span>
                      </label>
                      <HelpTooltip text="Dish menu price charged to customers. Keep this updated for food cost control." />
                    </div>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1"
                      placeholder="199"
                      value={modalForm.price}
                      onChange={(e) => setModalForm((prev) => ({ ...prev, price: e.target.value }))}
                      className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none transition font-medium"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                        Prep Time (mins)
                      </label>
                      <HelpTooltip text="Average kitchen cooking & packaging time. Helps compute customer delivery ETA." />
                    </div>
                    <input
                      type="number"
                      min="1"
                      placeholder="15"
                      value={modalForm.preparationTime}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, preparationTime: e.target.value }))
                      }
                      className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none transition font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                        Dietary Type
                      </label>
                      <HelpTooltip text="FSSAI standard: Pure Veg displays green dot emblem; Non-Veg displays red dot emblem." />
                    </div>
                    <select
                      value={modalForm.type}
                      onChange={(e) => setModalForm((prev) => ({ ...prev, type: e.target.value }))}
                      className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white focus:border-orange-500 outline-none transition font-medium cursor-pointer"
                    >
                      <option value="veg">🟢 Veg</option>
                      <option value="non-veg">🔴 Non-Veg</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                        Category <span className="text-orange-500">*</span>
                      </label>
                      <HelpTooltip text="Menu section where this dish will be organized on the customer-facing app." />
                    </div>
                    <select
                      value={modalForm.category}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, category: e.target.value }))
                      }
                      className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white focus:border-orange-500 outline-none transition font-medium cursor-pointer"
                    >
                      {selectableCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {modalForm.category === "Other" && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                      Custom Category Name <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Shakes, Platters, Specials..."
                      value={modalForm.customCategory}
                      onChange={(e) =>
                        setModalForm((prev) => ({ ...prev, customCategory: e.target.value }))
                      }
                      className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none transition font-medium"
                    />
                  </div>
                )}

                {/* ── PORTION & SERVING SIZE SECTION ──────────────────── */}
                <div className="p-4 rounded-2xl bg-orange-500/[0.04] dark:bg-white/[0.02] border border-orange-500/20 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">⚖️</span>
                      <label className="text-xs font-black text-stone-900 dark:text-white uppercase tracking-wider">
                        Serving Size & Food Portion
                      </label>
                    </div>
                    <span className="text-[10px] text-stone-400 font-medium">Transparent Pricing</span>
                  </div>

                  <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-normal">
                    Clearly inform customers how much food they receive for the price (e.g. 2 pieces, 250 ml bowl, 100 g).
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                        Serving Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="e.g. 2, 250, 100"
                        value={modalForm.portion?.quantity ?? ""}
                        onChange={(e) =>
                          setModalForm((prev) => ({
                            ...prev,
                            portion: { ...prev.portion, quantity: e.target.value },
                          }))
                        }
                        className="w-full bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                        Portion Unit
                      </label>
                      <select
                        value={modalForm.portion?.unit || "piece"}
                        onChange={(e) =>
                          setModalForm((prev) => ({
                            ...prev,
                            portion: { ...prev.portion, unit: e.target.value },
                          }))
                        }
                        className="w-full bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white focus:border-orange-500 outline-none font-medium cursor-pointer"
                      >
                        {PORTION_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                        Physical Size <span className="text-[10px] text-stone-400 lowercase font-normal">(opt)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 8 inches, Regular"
                        value={modalForm.portion?.size ?? ""}
                        onChange={(e) =>
                          setModalForm((prev) => ({
                            ...prev,
                            portion: { ...prev.portion, size: e.target.value },
                          }))
                        }
                        className="w-full bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none font-medium"
                      />
                    </div>
                  </div>

                  {modalForm.portion?.unit === "custom" && (
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                        Custom Unit Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Scoop, Glass, Pack, Bottle..."
                        value={modalForm.portion?.customUnit ?? ""}
                        onChange={(e) =>
                          setModalForm((prev) => ({
                            ...prev,
                            portion: { ...prev.portion, customUnit: e.target.value },
                          }))
                        }
                        className="w-full bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none font-medium"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">
                      Serving Description <span className="text-[10px] text-stone-400 lowercase font-normal">(customer label)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2 pieces per plate, 250 ml bowl, serves 1-2"
                      value={modalForm.portion?.servingLabel ?? ""}
                      onChange={(e) =>
                        setModalForm((prev) => ({
                          ...prev,
                          portion: { ...prev.portion, servingLabel: e.target.value },
                        }))
                      }
                      className="w-full bg-white dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none font-medium"
                    />
                  </div>

                  {/* Live Customer Preview Pill */}
                  <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400 shrink-0">
                        Live Preview:
                      </span>
                      <span className="text-xs font-black text-stone-900 dark:text-white font-mono truncate">
                        {getPortionPreviewText(
                          modalForm.price,
                          modalForm.portion,
                          modalForm.hasVariants,
                          modalForm.variants
                        )}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-400 shrink-0">Seen by customers</span>
                  </div>
                </div>

                {/* ── MULTIPLE SIZES / PRICING VARIANTS ───────────────── */}
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-white/[0.02] border border-stone-200/80 dark:border-white/10 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(modalForm.hasVariants)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setModalForm((prev) => ({
                            ...prev,
                            hasVariants: checked,
                            variants:
                              checked && (!prev.variants || prev.variants.length === 0)
                                ? [
                                    {
                                      id: `var_${Date.now()}_1`,
                                      name: "Small",
                                      price: prev.price || "149",
                                      portionQuantity: prev.portion?.quantity || "1",
                                      portionUnit: prev.portion?.unit || "serving",
                                      servingLabel: "Serves 1",
                                      size: "",
                                      isAvailable: true,
                                    },
                                    {
                                      id: `var_${Date.now()}_2`,
                                      name: "Medium",
                                      price: prev.price ? String(Math.round(Number(prev.price) * 1.5)) : "249",
                                      portionQuantity: prev.portion?.quantity ? String(Number(prev.portion.quantity) * 2) : "2",
                                      portionUnit: prev.portion?.unit || "serving",
                                      servingLabel: "Serves 2",
                                      size: "",
                                      isAvailable: true,
                                    },
                                  ]
                                : prev.variants,
                          }));
                        }}
                        className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-stone-900 dark:text-white">
                        Multiple Sizes / Pricing Variants (e.g. Small / Medium / Large)
                      </span>
                    </label>
                  </div>

                  {modalForm.hasVariants && (
                    <div className="space-y-3 pt-1">
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">
                        Configure size variants with individual pricing and portions. Customers will choose their desired size on the menu.
                      </p>

                      <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                        {(modalForm.variants || []).map((variant, idx) => (
                          <div
                            key={variant.id || idx}
                            className="p-3 rounded-xl bg-white dark:bg-stone-900/80 border border-stone-200 dark:border-white/10 space-y-2 shadow-xs"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                              <div className="sm:col-span-4">
                                <label className="block text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                                  Variant Name *
                                </label>
                                <input
                                  type="text"
                                  required
                                  placeholder="e.g. Regular / 250g / Large"
                                  value={variant.name}
                                  onChange={(e) => handleUpdateVariantRow(idx, "name", e.target.value)}
                                  className="w-full bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 dark:text-white font-medium focus:border-orange-500 outline-none"
                                />
                              </div>

                              <div className="sm:col-span-3">
                                <label className="block text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                                  Price (₹) *
                                </label>
                                <input
                                  type="number"
                                  required
                                  min="0"
                                  placeholder="149"
                                  value={variant.price}
                                  onChange={(e) => handleUpdateVariantRow(idx, "price", e.target.value)}
                                  className="w-full bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 dark:text-white font-mono font-bold focus:border-orange-500 outline-none"
                                />
                              </div>

                              <div className="sm:col-span-4">
                                <label className="block text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-0.5">
                                  Portion / Size
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. 250 ml / 8 inches"
                                  value={variant.servingLabel || ""}
                                  onChange={(e) => handleUpdateVariantRow(idx, "servingLabel", e.target.value)}
                                  className="w-full bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-stone-900 dark:text-white font-medium focus:border-orange-500 outline-none"
                                />
                              </div>

                              <div className="sm:col-span-1 flex items-center justify-end pt-3 sm:pt-0">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVariantRow(idx)}
                                  disabled={(modalForm.variants || []).length <= 1}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                  title="Delete variant"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleAddVariantRow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-orange-500/40 text-orange-600 dark:text-orange-400 text-xs font-bold hover:bg-orange-500/10 transition cursor-pointer"
                      >
                        <PlusCircle size={14} />
                        <span>+ Add Another Variant</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Dish Image Source */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                      Dish Photo
                    </label>
                    <div className="flex items-center gap-1 text-[11px] font-semibold bg-stone-100 dark:bg-white/5 p-0.5 rounded-lg border border-stone-200/80 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setImageMode("preset")}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                          imageMode === "preset"
                            ? "bg-white dark:bg-stone-800 text-orange-600 shadow-xs"
                            : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                        }`}
                      >
                        Presets
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageMode("file")}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                          imageMode === "file"
                            ? "bg-white dark:bg-stone-800 text-orange-600 shadow-xs"
                            : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                        }`}
                      >
                        Upload Device
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageMode("url")}
                        className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                          imageMode === "url"
                            ? "bg-white dark:bg-stone-800 text-orange-600 shadow-xs"
                            : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                        }`}
                      >
                        Web URL
                      </button>
                    </div>
                  </div>

                  {imageMode === "file" && (
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="w-full p-4 border border-dashed border-stone-300 dark:border-white/20 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-stone-50 dark:hover:bg-white/5 transition cursor-pointer disabled:opacity-50"
                      >
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center">
                          {uploadingImage ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <Upload className="w-5 h-5" />
                          )}
                        </div>
                        <span className="text-xs font-bold text-stone-700 dark:text-stone-200">
                          {uploadingImage ? "Uploading to Cloud..." : "Choose Photo from Device"}
                        </span>
                        <span className="text-[10px] text-stone-400">JPG, PNG, WEBP (Max 5MB)</span>
                      </button>
                    </div>
                  )}

                  {imageMode === "preset" && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto p-1.5 border border-stone-200/80 dark:border-white/10 rounded-xl bg-stone-50/50 dark:bg-white/5">
                      {PRESET_FOOD_PHOTOS.map((preset) => {
                        const isSelected = modalForm.image === preset.url;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setModalForm((prev) => ({
                                ...prev,
                                image: preset.url,
                              }));
                            }}
                            className={`group relative rounded-xl overflow-hidden border p-1 flex flex-col items-center gap-1 transition text-left cursor-pointer ${
                              isSelected
                                ? "border-orange-500 ring-2 ring-orange-500/20 bg-orange-50/40 dark:bg-orange-500/10"
                                : "border-stone-200/80 dark:border-white/10 hover:border-stone-300 dark:hover:border-white/20 bg-white dark:bg-stone-800"
                            }`}
                          >
                            <div className="w-full h-14 rounded-lg overflow-hidden relative bg-stone-100">
                              <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                              {isSelected && (
                                <div className="absolute inset-0 bg-orange-500/40 flex items-center justify-center">
                                  <Check className="w-4 h-4 text-white drop-shadow" />
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-stone-700 dark:text-stone-200 truncate w-full text-center">
                              {preset.icon} {preset.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {imageMode === "url" && (
                    <div className="space-y-1.5">
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/... or any picture URL"
                        value={modalForm.image}
                        onChange={(e) => setModalForm((prev) => ({ ...prev, image: e.target.value }))}
                        className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none transition font-medium"
                      />
                      <p className="text-[11px] text-stone-500 dark:text-stone-400">
                        Paste any web image URL. If unreachable, a category-matched food photo will automatically be used.
                      </p>
                    </div>
                  )}

                  {modalForm.image && (
                    <div className="relative h-28 rounded-xl overflow-hidden border border-stone-200 dark:border-white/10 mt-2 bg-stone-100 dark:bg-white/5 group">
                      <img
                        src={modalForm.image}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = getProductFallbackImage(modalForm);
                        }}
                      />
                      <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold">
                        Preview
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Mouth-watering details about this dish..."
                    value={modalForm.description}
                    onChange={(e) =>
                      setModalForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none transition resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-200/70 hover:bg-stone-200 dark:bg-white/5 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition active:scale-95 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-white dark:text-stone-900 disabled:opacity-50 transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    {submitting ? "Saving..." : isEditing ? "Update Dish" : "Create Dish"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── LAUNCH NEW CATEGORY MODAL (WITH IMAGE UPLOAD & PRESETS) ─ */}
        {isCategoryModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-hidden"
          >
            <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-auto">
              <div className="px-6 py-4 border-b border-stone-100 dark:border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-stone-900 dark:text-white">
                      Launch New Category
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Upload cover photo and make live on kitchen menu
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleLaunchCategory} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Category Name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Artisanal Pizza, Shakes & Beverages"
                    value={newCategoryForm.name}
                    onChange={(e) =>
                      setNewCategoryForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-amber-500 outline-none transition font-medium"
                    autoFocus
                  />
                </div>

                {/* Category Cover Image Section */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                    Category Cover Image
                  </label>

                  <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-white/5 rounded-xl border border-stone-200/80 dark:border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => setNewCatImageTab("upload")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        newCatImageTab === "upload"
                          ? "bg-white dark:bg-stone-800 text-orange-600 dark:text-orange-400 shadow-xs"
                          : "text-stone-500 hover:text-stone-900 dark:hover:text-white"
                      }`}
                    >
                      <Upload size={13} />
                      <span>Upload Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCatImageTab("preset")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        newCatImageTab === "preset"
                          ? "bg-white dark:bg-stone-800 text-orange-600 dark:text-orange-400 shadow-xs"
                          : "text-stone-500 hover:text-stone-900 dark:hover:text-white"
                      }`}
                    >
                      <ImageIcon size={13} />
                      <span>Presets</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCatImageTab("url")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        newCatImageTab === "url"
                          ? "bg-white dark:bg-stone-800 text-orange-600 dark:text-orange-400 shadow-xs"
                          : "text-stone-500 hover:text-stone-900 dark:hover:text-white"
                      }`}
                    >
                      <span>Web URL</span>
                    </button>
                  </div>

                  {newCatImageTab === "upload" && (
                    <div className="p-3 bg-stone-50 dark:bg-white/5 rounded-xl border border-dashed border-stone-300 dark:border-white/20 text-center">
                      <input
                        ref={newCatFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            processCategoryImage(file, (dataUrl) => {
                              setNewCategoryForm((prev) => ({ ...prev, image: dataUrl }));
                            });
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => newCatFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-white/10 text-xs font-semibold text-stone-800 dark:text-stone-200 shadow-xs cursor-pointer"
                      >
                        <Upload size={13} className="text-orange-500" />
                        <span>Select image file</span>
                      </button>
                    </div>
                  )}

                  {newCatImageTab === "preset" && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                      {PRESET_FOOD_PHOTOS.map((preset) => {
                        const isSelected = newCategoryForm.image === preset.url;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setNewCategoryForm((prev) => ({
                                ...prev,
                                image: preset.url,
                                icon: preset.icon || prev.icon,
                              }));
                            }}
                            className={`relative rounded-xl overflow-hidden border p-1 text-left cursor-pointer transition ${
                              isSelected
                                ? "border-orange-500 ring-2 ring-orange-500/30"
                                : "border-stone-200 dark:border-white/10 hover:border-orange-400"
                            }`}
                          >
                            <div className="h-12 w-full rounded-lg overflow-hidden relative">
                              <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                              {isSelected && (
                                <div className="absolute inset-0 bg-orange-600/40 flex items-center justify-center text-white">
                                  <Check size={14} className="stroke-[3]" />
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-stone-800 dark:text-stone-200 block truncate mt-1">
                              {preset.icon} {preset.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {newCatImageTab === "url" && (
                    <input
                      type="url"
                      value={newCategoryForm.image}
                      onChange={(e) => setNewCategoryForm((prev) => ({ ...prev, image: e.target.value }))}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-orange-500 text-stone-900 dark:text-white"
                    />
                  )}

                  {newCategoryForm.image && (
                    <div className="relative h-24 rounded-xl overflow-hidden border border-stone-200 dark:border-white/10 mt-2">
                      <img src={newCategoryForm.image} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setNewCategoryForm((prev) => ({ ...prev, image: "" }))}
                        className="absolute top-2 right-2 p-1 rounded-lg bg-black/60 text-white text-xs cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Category Emoji / Icon
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={newCategoryForm.icon}
                      onChange={(e) =>
                        setNewCategoryForm((prev) => ({ ...prev, icon: e.target.value }))
                      }
                      className="w-14 text-center text-xl bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl py-2 text-stone-900 dark:text-white focus:border-amber-500 outline-none"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {["🍔", "🍕", "🍟", "🥟", "🥤", "🍛", "🌯", "🍜", "🍰", "🥗", "🍲", "☕"].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() =>
                            setNewCategoryForm((prev) => ({ ...prev, icon: emoji }))
                          }
                          className={`w-8 h-8 rounded-lg text-sm border flex items-center justify-center transition cursor-pointer ${
                            newCategoryForm.icon === emoji
                              ? "border-amber-500 bg-amber-500/10"
                              : "border-stone-200/80 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/5"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Description <span className="text-[10px] text-stone-400 font-normal lowercase">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short description for customer menu..."
                    value={newCategoryForm.description}
                    onChange={(e) =>
                      setNewCategoryForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-amber-500 outline-none transition resize-none"
                  />
                </div>

                </div>

                <div className="px-6 py-3.5 border-t border-stone-100 dark:border-white/10 shrink-0 flex items-center justify-end gap-2.5 bg-stone-50/50 dark:bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-white/5 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={launchingCategory || !newCategoryForm.name.trim()}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-stone-950 disabled:opacity-50 transition shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles size={14} />
                    <span>{launchingCategory ? "Launching..." : "Launch Category"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── EDIT CATEGORY MODAL (WITH IMAGE UPLOAD & PRESETS) ───── */}
        {isEditCategoryModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 overflow-hidden"
          >
            <div className="bg-white dark:bg-[#10141f] border border-stone-200/90 dark:border-white/10 rounded-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-auto">
              <div className="px-6 py-4 border-b border-stone-100 dark:border-white/10 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                    <Pencil size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-stone-900 dark:text-white">
                      Edit Category: {editCategoryForm.name}
                    </h2>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Update category cover image, icon and details
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditCategoryModalOpen(false)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateCategory} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Category Name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCategoryForm.name}
                    onChange={(e) =>
                      setEditCategoryForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none transition font-medium"
                  />
                </div>

                {/* Category Cover Image Section */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                    Category Cover Image
                  </label>

                  <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-white/5 rounded-xl border border-stone-200/80 dark:border-white/10 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditCatImageTab("upload")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        editCatImageTab === "upload"
                          ? "bg-white dark:bg-stone-800 text-orange-600 dark:text-orange-400 shadow-xs"
                          : "text-stone-500 hover:text-stone-900 dark:hover:text-white"
                      }`}
                    >
                      <Upload size={13} />
                      <span>Upload Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCatImageTab("preset")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        editCatImageTab === "preset"
                          ? "bg-white dark:bg-stone-800 text-orange-600 dark:text-orange-400 shadow-xs"
                          : "text-stone-500 hover:text-stone-900 dark:hover:text-white"
                      }`}
                    >
                      <ImageIcon size={13} />
                      <span>Presets</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditCatImageTab("url")}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        editCatImageTab === "url"
                          ? "bg-white dark:bg-stone-800 text-orange-600 dark:text-orange-400 shadow-xs"
                          : "text-stone-500 hover:text-stone-900 dark:hover:text-white"
                      }`}
                    >
                      <span>Web URL</span>
                    </button>
                  </div>

                  {editCatImageTab === "upload" && (
                    <div className="p-3 bg-stone-50 dark:bg-white/5 rounded-xl border border-dashed border-stone-300 dark:border-white/20 text-center">
                      <input
                        ref={editCatFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            processCategoryImage(file, (dataUrl) => {
                              setEditCategoryForm((prev) => ({ ...prev, image: dataUrl }));
                            });
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => editCatFileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-white/10 text-xs font-semibold text-stone-800 dark:text-stone-200 shadow-xs cursor-pointer"
                      >
                        <Upload size={13} className="text-orange-500" />
                        <span>Select image file</span>
                      </button>
                    </div>
                  )}

                  {editCatImageTab === "preset" && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                      {PRESET_FOOD_PHOTOS.map((preset) => {
                        const isSelected = editCategoryForm.image === preset.url;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setEditCategoryForm((prev) => ({
                                ...prev,
                                image: preset.url,
                                icon: preset.icon || prev.icon,
                              }));
                            }}
                            className={`relative rounded-xl overflow-hidden border p-1 text-left cursor-pointer transition ${
                              isSelected
                                ? "border-orange-500 ring-2 ring-orange-500/30"
                                : "border-stone-200 dark:border-white/10 hover:border-orange-400"
                            }`}
                          >
                            <div className="h-12 w-full rounded-lg overflow-hidden relative">
                              <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                              {isSelected && (
                                <div className="absolute inset-0 bg-orange-600/40 flex items-center justify-center text-white">
                                  <Check size={14} className="stroke-[3]" />
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-stone-800 dark:text-stone-200 block truncate mt-1">
                              {preset.icon} {preset.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {editCatImageTab === "url" && (
                    <input
                      type="url"
                      value={editCategoryForm.image}
                      onChange={(e) => setEditCategoryForm((prev) => ({ ...prev, image: e.target.value }))}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3 py-2 text-xs bg-stone-50 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-orange-500 text-stone-900 dark:text-white"
                    />
                  )}

                  {editCategoryForm.image && (
                    <div className="relative h-24 rounded-xl overflow-hidden border border-stone-200 dark:border-white/10 mt-2">
                      <img src={editCategoryForm.image} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setEditCategoryForm((prev) => ({ ...prev, image: "" }))}
                        className="absolute top-2 right-2 p-1 rounded-lg bg-black/60 text-white text-xs cursor-pointer"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Category Emoji / Icon
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={editCategoryForm.icon}
                      onChange={(e) =>
                        setEditCategoryForm((prev) => ({ ...prev, icon: e.target.value }))
                      }
                      className="w-14 text-center text-xl bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl py-2 text-stone-900 dark:text-white focus:border-orange-500 outline-none"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {["🍔", "🍕", "🍟", "🥟", "🥤", "🍛", "🌯", "🍜", "🍰", "🥗", "🍲", "☕"].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() =>
                            setEditCategoryForm((prev) => ({ ...prev, icon: emoji }))
                          }
                          className={`w-8 h-8 rounded-lg text-sm border flex items-center justify-center transition cursor-pointer ${
                            editCategoryForm.icon === emoji
                              ? "border-orange-500 bg-orange-500/10"
                              : "border-stone-200/80 dark:border-white/10 hover:bg-stone-100 dark:hover:bg-white/5"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short description for customer menu..."
                    value={editCategoryForm.description}
                    onChange={(e) =>
                      setEditCategoryForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="w-full bg-stone-50/80 dark:bg-white/5 border border-stone-200 dark:border-white/10 rounded-xl px-3.5 py-2 text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:border-orange-500 outline-none transition resize-none"
                  />
                </div>

                </div>

                <div className="px-6 py-3.5 border-t border-stone-100 dark:border-white/10 shrink-0 flex items-center justify-end gap-2.5 bg-stone-50/50 dark:bg-white/[0.02]">
                  <button
                    type="button"
                    onClick={() => setIsEditCategoryModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-white/5 dark:hover:bg-white/10 text-stone-700 dark:text-stone-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCategory || !editCategoryForm.name.trim()}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    {savingCategory && <RefreshCw size={13} className="animate-spin" />}
                    <span>{savingCategory ? "Saving..." : "Save Category"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
