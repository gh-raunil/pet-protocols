import DownloadClient from "./DownloadClient";

export const metadata = {
  title: "Download पेट Protocols Android App | Fresh Food. Zero Compromises.",
  description:
    "Download the official पेट Protocols Android app (APK). Order your favourite gourmet meals, track orders in real time, and enjoy a seamless full-screen dining experience.",
  keywords: [
    "पेट Protocols app",
    "download पेट Protocols APK",
    "Android food app",
    "gourmet food delivery app",
    "पेट Protocols Android release",
  ],
  openGraph: {
    title: "Download पेट Protocols Android App | Fresh Food. Zero Compromises.",
    description:
      "Get the official पेट Protocols Android app. Direct APK download, full-screen speed, and real-time order tracking.",
    url: "https://pet-protocols.vercel.app/download",
    siteName: "पेट Protocols",
    images: [
      {
        url: "/screenshots/desktop-home.png",
        width: 1280,
        height: 720,
        alt: "पेट Protocols Application Preview",
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
