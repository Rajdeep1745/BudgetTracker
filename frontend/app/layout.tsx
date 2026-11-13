import "./theme.css";
import "./globals.css";
import type { Metadata } from "next";
import { ToastProvider } from "../components/ToastProvider";

export const metadata: Metadata = {
  title: "PocketPlan Budget Tracker",
  description: "Monthly budget dashboard",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
