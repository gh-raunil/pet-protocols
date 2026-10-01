export default function manifest() {
  return {
    id: "/",
    name: "Pet Protocols",
    short_name: "Pet Protocols",
    description: "Order your favourite food with Pet Protocols.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF7F2",
    theme_color: "#EA580C",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    screenshots: [
      {
        src: "/screenshots/desktop-home.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "Pet Protocols Home Page on Desktop",
      },
      {
        src: "/screenshots/mobile-home.png",
        sizes: "750x1334",
        type: "image/png",
        form_factor: "narrow",
        label: "Pet Protocols Mobile Experience",
      },
    ],
    categories: ["food", "shopping", "lifestyle"],
  };
}
