import DownloadClient from "./DownloadClient";

export const metadata = {
  title: "Download Pet Protocols Android App | Fresh Food. Zero Compromises.",
  description:
    "Download the official Pet Protocols Android app (APK). Order your favourite gourmet meals, track orders in real time, and enjoy a seamless full-screen dining experience.",
  keywords: [
    "Pet Protocols app",
    "download Pet Protocols APK",
    "Android food app",
    "gourmet food delivery app",
    "Pet Protocols Android release",
  ],
  openGraph: {
    title: "Download Pet Protocols Android App | Fresh Food. Zero Compromises.",
    description:
      "Get the official Pet Protocols Android app. Direct APK download, full-screen speed, and real-time order tracking.",
    url: "https://pet-protocols.vercel.app/download",
    siteName: "Pet Protocols",
    images: [
      {
        url: "/screenshots/desktop-home.png",
        width: 1280,
        height: 720,
        alt: "Pet Protocols Application Preview",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  alternates: {
    canonical: "https://pet-protocols.vercel.app/download",
  },
};

export default function DownloadPage() {
  return <DownloadClient />;
}
