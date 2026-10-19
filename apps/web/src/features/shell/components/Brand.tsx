import Link from "next/link";
import { BRAND, LogoMark, Wordmark } from "@/shared/brand";
export function Brand() {
  return (
    <Link href="/" className="brand" aria-label={BRAND.name}>
      <LogoMark size={34} />
      <Wordmark className="brand-text" />
    </Link>
  );
}
