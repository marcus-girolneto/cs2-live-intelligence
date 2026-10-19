import type { Metadata } from "next";
import { BRAND } from "@/shared/brand";

export const metadata: Metadata = { title: BRAND.coach };
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
