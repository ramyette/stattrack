import Link from "next/link";
import AccountMenu from "@/components/account-menu";
import InvitationButton from "@/components/invitation-button";
import ThemeToggle from "@/components/theme-toggle";
import Image from "next/image";
import type { Profile } from "@/types/app";

export default function AppHeader({ profile, email, children, logoUrl }: { profile: Profile; email: string; children?: React.ReactNode; logoUrl?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--header)] px-5 py-3 backdrop-blur-2xl sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href="/projects" className="flex items-center gap-3 font-bold">
          <span className="relative grid h-10 w-10 overflow-hidden rounded-[14px] bg-gradient-to-br from-orange-400 via-rose-500 to-violet-600 text-white shadow-lg shadow-orange-500/20">{logoUrl ? <Image src={logoUrl} alt="Project logo" fill unoptimized className="object-cover" /> : <Image src="/icon.svg" alt="StatTrack" fill priority className="object-cover" />}</span>
          <span className="text-xl tracking-[-0.04em]">StatTrack</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">{children}<ThemeToggle profile={profile} /><InvitationButton /><AccountMenu profile={profile} email={email} /></div>
      </div>
    </header>
  );
}
