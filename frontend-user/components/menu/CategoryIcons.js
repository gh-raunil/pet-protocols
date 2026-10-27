import React from "react";

export function AllCategoryIcon({ className = "w-6 h-6", active = false }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} stroke="currentColor">
      {/* Whimsical noodle swirl / culinary fork doodle */}
      <path
        d="M8 7c0 4 3 6 3 9s-3 5-3 9M14 7c0 4 3 6 3 9s-3 5-3 9M20 7c0 4 3 6 3 9s-3 5-3 9M24 16c0 3 2 5 2 8"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BurgerCategoryIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      {/* Top bun */}
      <path
        d="M6 14C6 8.5 10.5 5 16 5s10 3.5 10 9H6z"
        fill="#FF9F43"
      />
      {/* Sesame seeds */}
      <circle cx="12" cy="9" r="0.9" fill="#FFF2D6" />
      <circle cx="16" cy="8" r="0.9" fill="#FFF2D6" />
      <circle cx="20" cy="9.5" r="0.9" fill="#FFF2D6" />
      {/* Lettuce / Greens */}
      <path
        d="M5 14.5c1.5 1 3-0.5 4.5 0.5s3-0.5 4.5 0.5 3-0.5 4.5 0.5 3-0.5 4.5 0.5 2.5-0.5 3.5 0"
        stroke="#2ED573"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Cheese slice */}
      <path d="M6 17.5h20l-4 3H6v-3z" fill="#FFA502" />
      {/* Patty */}
      <rect x="5.5" y="19" width="21" height="4" rx="2" fill="#8B4513" />
      {/* Bottom bun */}
      <path
        d="M6.5 23.5h19c0 3-4 4.5-9.5 4.5s-9.5-1.5-9.5-4.5z"
        fill="#FF9F43"
      />
    </svg>
  );
}

export function PizzaCategoryIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      {/* Pizza crust and slice */}
      <path
        d="M16 4C19 4 25 5 27 6.5c-2.5 7.5-6.5 17-11 21.5C11.5 23.5 7.5 14 5 6.5 7 5 13 4 16 4z"
        fill="#FF7F50"
      />
      {/* Crust rim */}
      <path
        d="M5 6.5C7 5 13 4 16 4s9 1 11 2.5"
        stroke="#E65100"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Cheese layer */}
      <path
        d="M8 8.5c2.5-0.5 5.5-0.8 8-0.8s5.5 0.3 8 0.8c-2 6-5.5 13.5-8 17-2.5-3.5-6-11-8-17z"
        fill="#FFD166"
      />
      {/* Pepperoni & basil toppings */}
      <circle cx="16" cy="11" r="2.2" fill="#D32F2F" />
      <circle cx="12.5" cy="16" r="1.8" fill="#D32F2F" />
      <circle cx="18.5" cy="17.5" r="2" fill="#D32F2F" />
      <circle cx="15.5" cy="21" r="1.3" fill="#2E7D32" />
    </svg>
  );
}

export function MomosCategoryIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      {/* Steamed Dumpling / Momo shape with pleats */}
      <path
        d="M7 21c0 4 4 6.5 9 6.5s9-2.5 9-6.5C25 15 20 8 16 7c-4 1-9 8-9 14z"
        fill="#FFF3E0"
        stroke="#FFB74D"
        strokeWidth="1.5"
      />
      {/* Pleats on top */}
      <path
        d="M16 7v6M13.5 8.5l2 4.5M18.5 8.5l-2 4.5M10.5 12l4 3M21.5 12l-4 3"
        stroke="#FFA726"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Dumpling pinch knot */}
      <circle cx="16" cy="7.5" r="1.5" fill="#FF9800" />
    </svg>
  );
}

export function IndianCategoryIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      {/* Traditional clay handi / curry bowl */}
      <path
        d="M8 14h16c1.5 0 2.5 1.5 2.5 3 0 6-4.5 10-10.5 10S5.5 23 5.5 17c0-1.5 1-3 2.5-3z"
        fill="#FF8A65"
      />
      {/* Curry surface */}
      <ellipse cx="16" cy="14" rx="8" ry="3" fill="#FFB74D" />
      {/* Aromatic steam */}
      <path
        d="M16 6c-0.8 1.5 0.8 2.5 0 4M12 8c-0.8 1 0.8 2 0 3M20 8c-0.8 1 0.8 2 0 3"
        stroke="#E65100"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Garnish herb / bay leaf */}
      <circle cx="16" cy="14" r="1.5" fill="#43A047" />
    </svg>
  );
}

export function SaladsCategoryIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      {/* Vibrant healthy heart-shaped salad leaf */}
      <path
        d="M16 26s-8-5.5-8-12c0-3.5 2.5-6 5.5-6 2.5 0 3.5 2 4.5 3 1-1 2-3 4.5-3 3 0 5.5 2.5 5.5 6 0 6.5-8 12-8 12z"
        fill="#4CAF50"
      />
      {/* Leaf vein */}
      <path
        d="M16 11v11M16 14l-3-2M16 17l3-2M16 19l-2.5-1.5"
        stroke="#81C784"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DessertsCategoryIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      {/* Cupcake base / cup */}
      <path
        d="M9 17l1.8 9c0.2 1 1 1.5 2 1.5h6.4c1 0 1.8-0.5 2-1.5L23 17H9z"
        fill="#FFE0B2"
        stroke="#FFA726"
        strokeWidth="1.2"
      />
      {/* Swirled rich frosting */}
      <path
        d="M9 17c-1-2 0.5-5 3.5-5 0.5-3 3-5 5.5-5s4.5 2 4.5 4c2.5 0.5 4 2.5 3 6H9z"
        fill="#E91E63"
      />
      {/* Cherry on top */}
      <circle cx="17.5" cy="6.5" r="2" fill="#C2185B" />
      <path d="M18.5 5.5c1-2 3-2.5 4-2" stroke="#4CAF50" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function DrinksCategoryIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      {/* Beverage cup with lid & straw */}
      <path
        d="M10 12l1.6 14c0.1 1 1 1.8 2 1.8h4.8c1 0 1.9-0.8 2-1.8L22 12H10z"
        fill="#FF9800"
      />
      {/* Liquid gradient line */}
      <path d="M10.8 15h10.4l-1.3 11H12.1L10.8 15z" fill="#FFA726" />
      {/* Lid */}
      <path
        d="M8.5 12h15c0.8 0 1.5-0.7 1.5-1.5s-0.7-1.5-1.5-1.5h-15C7.7 9 7 9.7 7 10.5S7.7 12 8.5 12z"
        fill="#EEEEEE"
      />
      {/* Straw */}
      <path
        d="M17 9V4l3-1.5"
        stroke="#E0E0E0"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BowlsCategoryIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      {/* Ramen / Poke bowl */}
      <path
        d="M6 14c0 7 4.5 12 10 12s10-5 10-12H6z"
        fill="#E53935"
      />
      {/* Rim */}
      <ellipse cx="16" cy="14" rx="10" ry="3" fill="#FFCDD2" />
      {/* Chopsticks */}
      <path
        d="M24 6L11 16M26 8L13 18"
        stroke="#795548"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function FriesCategoryIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      {/* French fries packet */}
      <path d="M10 16l1.5 11h9l1.5-11H10z" fill="#E53935" />
      <path d="M11 16c2.5 2 7.5 2 10 0" fill="#C62828" />
      {/* Golden crispy fries sticks */}
      <rect x="11" y="8" width="2.5" height="10" rx="1" fill="#FFCA28" />
      <rect x="14.5" y="6" width="2.5" height="12" rx="1" fill="#FFD54F" />
      <rect x="18" y="7" width="2.5" height="11" rx="1" fill="#FFCA28" />
      <rect x="13" y="10" width="2.5" height="8" rx="1" fill="#FFC107" />
    </svg>
  );
}

// Map helper to resolve category names to matching circular icon badges
export function getCategoryBadge(categoryId = "", label = "") {
  const norm = (categoryId || label || "").toLowerCase().trim();

  if (norm === "all" || norm === "all dishes") {
    return {
      type: "all",
      bgClass: "bg-orange-500 text-white shadow-orange-500/30",
      renderIcon: (active) => <AllCategoryIcon className="w-7 h-7" active={active} />,
    };
  }

  if (norm.includes("burger")) {
    return {
      type: "burger",
      bgClass: "bg-amber-100/90 dark:bg-amber-950/40 text-amber-600",
      renderIcon: () => <BurgerCategoryIcon className="w-6 h-6" />,
    };
  }

  if (norm.includes("pizza")) {
    return {
      type: "pizza",
      bgClass: "bg-rose-100/90 dark:bg-rose-950/40 text-rose-600",
      renderIcon: () => <PizzaCategoryIcon className="w-6 h-6" />,
    };
  }

  if (norm.includes("momo") || norm.includes("dumpling")) {
    return {
      type: "momos",
      bgClass: "bg-orange-100/90 dark:bg-orange-950/40 text-orange-600",
      renderIcon: () => <MomosCategoryIcon className="w-6 h-6" />,
    };
  }

  if (norm.includes("indian") || norm.includes("curry") || norm.includes("kalakand") || norm.includes("jamun") || norm.includes("thali") || norm.includes("biryani") || norm.includes("paneer")) {
    return {
      type: "indian",
      bgClass: "bg-amber-100/90 dark:bg-amber-950/40 text-amber-700",
      renderIcon: () => <IndianCategoryIcon className="w-6 h-6" />,
    };
  }

  if (norm.includes("salad") || norm.includes("healthy") || norm.includes("green")) {
    return {
      type: "salads",
      bgClass: "bg-emerald-100/90 dark:bg-emerald-950/40 text-emerald-600",
      renderIcon: () => <SaladsCategoryIcon className="w-6 h-6" />,
    };
  }

  if (norm.includes("dessert") || norm.includes("sweet") || norm.includes("cake") || norm.includes("ice cream")) {
    return {
      type: "desserts",
      bgClass: "bg-pink-100/90 dark:bg-pink-950/40 text-pink-600",
      renderIcon: () => <DessertsCategoryIcon className="w-6 h-6" />,
    };
  }

  if (norm.includes("drink") || norm.includes("beverage") || norm.includes("cold") || norm.includes("shake") || norm.includes("juice") || norm.includes("tea") || norm.includes("coffee")) {
    return {
      type: "drinks",
      bgClass: "bg-amber-100/90 dark:bg-amber-950/40 text-amber-600",
      renderIcon: () => <DrinksCategoryIcon className="w-6 h-6" />,
    };
  }

  if (norm.includes("bowl") || norm.includes("rice") || norm.includes("noodles") || norm.includes("chinese")) {
    return {
      type: "bowls",
      bgClass: "bg-red-100/90 dark:bg-red-950/40 text-red-600",
      renderIcon: () => <BowlsCategoryIcon className="w-6 h-6" />,
    };
  }

  if (norm.includes("frie")) {
    return {
      type: "fries",
      bgClass: "bg-yellow-100/90 dark:bg-yellow-950/40 text-yellow-600",
      renderIcon: () => <FriesCategoryIcon className="w-6 h-6" />,
    };
  }

  // Generic fallback with subtle culinary badge
  return {
    type: "default",
    bgClass: "bg-orange-50 dark:bg-stone-800 text-orange-500",
    renderIcon: () => <AllCategoryIcon className="w-5 h-5 text-orange-500" />,
  };
}
