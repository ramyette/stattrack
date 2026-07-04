import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legal | StatTrack",
  description: "Privacy, terms, payments, and storage information for StatTrack.",
};

const sectionClass = "scroll-mt-24 border-t border-[var(--border)] pt-10";
const headingClass = "text-2xl font-bold tracking-tight";
const paragraphClass = "mt-4 leading-7 text-[var(--muted)]";
const listClass = "mt-4 list-disc space-y-2 pl-5 leading-7 text-[var(--muted)]";

export default function LegalPage() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@ramyette.dev";

  return (
    <main className="page-shell min-h-screen flex-1 px-5 py-12 text-[var(--foreground)] sm:px-8 lg:px-12">
      <article className="relative mx-auto max-w-3xl">
        <Link href="/" className="back-button"><span aria-hidden="true">‹</span> StatTrack</Link>

        <header className="mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">StatTrack</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Legal information</h1>
          <p className="mt-4 text-[var(--muted)]">Effective July 3, 2026. Last updated July 3, 2026.</p>
          <div className="premium-card mt-7 rounded-2xl p-5 text-sm leading-6 text-[var(--muted)]">
            StatTrack is a public beta operated by the owner of ramyette.dev. Anyone with a supported Google account may register. It does not currently offer paid plans, advertising, or third-party analytics.
          </div>
        </header>

        <nav className="premium-card my-10 grid grid-cols-2 gap-3 rounded-2xl p-5 text-sm sm:grid-cols-4" aria-label="Legal sections">
          <a href="#privacy" className="font-semibold hover:text-[var(--accent)]">Privacy</a>
          <a href="#terms" className="font-semibold hover:text-[var(--accent)]">Terms</a>
          <a href="#payments" className="font-semibold hover:text-[var(--accent)]">Payments</a>
          <a href="#storage" className="font-semibold hover:text-[var(--accent)]">Storage</a>
        </nav>

        <div className="space-y-12">
          <section id="privacy" className={sectionClass}>
            <h2 className={headingClass}>Privacy Policy</h2>
            <p className={paragraphClass}>StatTrack uses Google for sign-in, Supabase for authentication, database, file storage, and database updates, and Vercel to host the application.</p>

            <h3 className="mt-7 text-lg font-bold">Information handled by StatTrack</h3>
            <ul className={listClass}>
              <li>Your Google account identifier, email address, display name, and profile picture.</li>
              <li>Project names, colors, membership roles, invitations, blocked-account relationships, and invitation preferences.</li>
              <li>Video titles, statistics, thumbnails, categories, notes, publication dates, and optional hype values.</li>
              <li>A recent activity timestamp used to show whether another project member is currently viewing a project.</li>
              <li>Technical logs produced by hosting, authentication, database, and security providers.</li>
            </ul>

            <h3 className="mt-7 text-lg font-bold">How information is used</h3>
            <ul className={listClass}>
              <li>Authenticate accounts and keep the service working.</li>
              <li>Store, display, synchronize, and calculate analytics from information entered into projects.</li>
              <li>Provide invitations and optional project sharing.</li>
              <li>Protect accounts, enforce limits, investigate errors, and prevent abuse.</li>
              <li>Meet legal obligations and protect the rights and safety of users and the service.</li>
            </ul>

            <h3 className="mt-7 text-lg font-bold">Sharing and public information</h3>
            <p className={paragraphClass}>Project information is available only to project members under database access policies. Display names and profile pictures are visible to relevant project members and invitation participants. User-uploaded avatar files are stored in a public avatar bucket so they can be displayed, while project media is stored privately. StatTrack does not sell personal information.</p>

            <h3 className="mt-7 text-lg font-bold">Retention and account choices</h3>
            <p className={paragraphClass}>Project data remains until it is deleted by an authorized user or the account is deleted. Activity timestamps are updated while a project is open and stop being treated as active after a short period. Security and provider logs may remain for the retention periods set by Vercel, Supabase, Google, or applicable law. Account settings provide profile correction, invitation controls, blocked-user controls, and permanent account deletion.</p>

            <h3 className="mt-7 text-lg font-bold">Children and security</h3>
            <p className={paragraphClass}>StatTrack is not directed to children under 13 or a higher minimum age required by local law. Reasonable administrative and technical safeguards are used, but no online service can guarantee absolute security.</p>
          </section>

          <section id="terms" className={sectionClass}>
            <h2 className={headingClass}>Terms of Service</h2>
            <p className={paragraphClass}>By using StatTrack, you agree to these terms and confirm that you can legally enter this agreement. You are responsible for activity on your account and for the accuracy and legality of information you upload.</p>

            <h3 className="mt-7 text-lg font-bold">Your content</h3>
            <p className={paragraphClass}>You retain ownership of your content. You give StatTrack a limited, nonexclusive permission to host, copy, process, and display it only as needed to operate, secure, and improve the service. You must have permission to upload all titles, images, notes, statistics, and other content you provide.</p>

            <h3 className="mt-7 text-lg font-bold">Acceptable use</h3>
            <ul className={listClass}>
              <li>Do not break laws or infringe intellectual property, privacy, publicity, or other rights.</li>
              <li>Do not upload malware, harmful content, deceptive content, or content you are not allowed to use.</li>
              <li>Do not probe security, bypass access controls or limits, scrape the service, automate abusive requests, or attempt to access another account or project.</li>
              <li>Do not resell access to the service or use it to operate an abusive or unlawful service.</li>
            </ul>

            <h3 className="mt-7 text-lg font-bold">Availability and termination</h3>
            <p className={paragraphClass}>This public beta may change, experience interruptions, or be discontinued. Access may be suspended or terminated for abuse, security risk, legal requirements, or violations of these terms. Where practical, reasonable notice will be provided.</p>

            <h3 className="mt-7 text-lg font-bold">Third-party services</h3>
            <p className={paragraphClass}>Google, Supabase, Vercel, and any linked third-party service have their own terms and privacy practices. StatTrack is not affiliated with or endorsed by YouTube or Google. Third-party availability and decisions are outside StatTrack&apos;s control.</p>

            <h3 className="mt-7 text-lg font-bold">Disclaimers and liability</h3>
            <p className={paragraphClass}>To the fullest extent permitted by law, StatTrack is provided as is and as available without warranties of uninterrupted operation, accuracy, fitness for a particular purpose, or noninfringement. Statistics and calculated insights are informational and are not legal, financial, or professional advice. To the fullest extent permitted by law, StatTrack and its operator are not liable for indirect, incidental, special, consequential, exemplary, or lost-profit damages. Rights and liabilities that cannot legally be excluded remain unaffected.</p>
          </section>

          <section id="payments" className={sectionClass}>
            <h2 className={headingClass}>Payments</h2>
            <p className={paragraphClass}>StatTrack does not currently charge users, collect payment card information, offer subscriptions, or provide paid plans. Payment terms, cancellation controls, refund terms, tax disclosures, and the Privacy Policy will be updated before any paid service is offered.</p>
          </section>

          <section id="storage" className={sectionClass}>
            <h2 className={headingClass}>Cookies and browser storage</h2>
            <p className={paragraphClass}>StatTrack uses authentication cookies required to keep users signed in and browser local storage to remember appearance preferences. It does not currently use advertising cookies or optional analytics cookies. If nonessential tracking is introduced, this notice and any consent controls will be updated first where required.</p>
          </section>

          <section id="contact" className={sectionClass}>
            <h2 className={headingClass}>Changes and contact</h2>
            <p className={paragraphClass}>This page may change as StatTrack develops. The date above will be updated when changes take effect, and material changes will receive reasonable notice where practical.</p>
            <p className={paragraphClass}>Questions, privacy requests, and legal notices can be sent to <a className="font-semibold text-[var(--accent)] hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>. Mandatory rights and legal remedies provided by applicable law remain available.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
