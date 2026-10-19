import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "CS2 Live Intelligence",
  description: "Your own CS2 match telemetry, live.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
