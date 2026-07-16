import type { Metadata } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "../components/service-worker-registration.js";

export const metadata: Metadata = {
  title: { default: "Dominoes", template: "%s · Dominoes" },
  description: "A quiet, beautifully crafted game of Draw Dominoes.",
  applicationName: "Dominoes"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="uk"><body>{children}<ServiceWorkerRegistration /></body></html>;
}
