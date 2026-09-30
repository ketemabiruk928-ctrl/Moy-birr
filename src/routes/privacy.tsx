import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader, AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Moybirr" },
      {
        name: "description",
        content:
          "Moybirr Privacy Policy — how we collect, use, and protect your data.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <AppShell>
      <AppHeader
        title="Privacy Policy"
        subtitle="Last updated: 30 September 2026"
      />
      <div className="-mt-6 space-y-4 px-4 pb-6">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Link>
        </Button>

        <Card className="shadow-card space-y-4 p-5 text-sm leading-relaxed">
          <section>
            <h2 className="mb-2 text-base font-semibold">1. Introduction</h2>
            <p>
              Moybirr ("we", "us", "our") is a digital hospitality platform built
              for Ethiopia. This Privacy Policy explains what personal data we
              collect, how we use it, and your rights under the Ethiopian Personal
              Data Protection Proclamation No. 1321/2024 and applicable
              international law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">2. Data We Collect</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong>Account data:</strong> name, phone number, email, profile
                photo
              </li>
              <li>
                <strong>Role data:</strong> whether you are a guest, staff, or hotel
                owner
              </li>
              <li>
                <strong>Workplace data:</strong> hotel name, hotel ID, position,
                city, subcity, wereda, house number (staff only)
              </li>
              <li>
                <strong>Location data:</strong> GPS coordinates (only when you
                choose to share it)
              </li>
              <li>
                <strong>Financial data:</strong> wallet balance, transaction
                history, payment receipts
              </li>
              <li>
                <strong>Workforce data:</strong> clock-in/out times, shift
                schedules, salary records, attendance
              </li>
              <li>
                <strong>Communications:</strong> team chat messages, meeting
                details, feedback messages
              </li>
              <li>
                <strong>Technical data:</strong> device type, browser, IP address,
                usage logs
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">3. Why We Collect It</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>To create and manage your account</li>
              <li>To process payments, tips, and wallet transactions</li>
              <li>
                To calculate payroll with Ethiopian tax and pension rules
              </li>
              <li>To schedule shifts and track attendance</li>
              <li>
                To send notifications about bookings, payments, shifts, and
                meetings
              </li>
              <li>To connect guests with hotels and staff</li>
              <li>To comply with Ethiopian tax, invoicing, and labor law</li>
              <li>To prevent fraud and secure the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">4. Legal Basis</h2>
            <p>
              We process your data based on: (a) your consent; (b) performance of
              our contract with you; (c) compliance with Ethiopian legal
              obligations; and (d) our legitimate interest in operating a secure and
              functional platform.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">
              5. Where Your Data Is Stored
            </h2>
            <p>
              Your data is stored securely on <strong>Supabase</strong> (PostgreSQL
              database) and delivered through <strong>Vercel</strong> (global CDN).
              Data may be stored on servers outside Ethiopia. We use encryption in
              transit (HTTPS/SSL) and Row-Level Security to protect your data.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">6. Who We Share With</h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong>Your hotel owner:</strong> your name, position, shift,
                attendance, and salary (if you are staff)
              </li>
              <li>
                <strong>Payment providers:</strong> Chapa and partner banks (for
                transactions you initiate)
              </li>
              <li>
                <strong>SMS providers:</strong> AfroMessage (for notifications you
                opt into)
              </li>
              <li>
                <strong>Government bodies:</strong> only when legally required, and
                only through approved electronic invoicing systems
              </li>
            </ul>
            <p className="mt-2">
              We <strong>do not sell</strong> your personal data. Ever.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">
              7. How Long We Keep Data
            </h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>Account data: while your account is active + 12 months</li>
              <li>Financial records: 5 years (Ethiopian tax law requirement)</li>
              <li>Payroll records: 5 years (Ethiopian labor law requirement)</li>
              <li>Communications: 24 months</li>
              <li>Technical logs: 12 months</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">8. Your Rights</h2>
            <p>Under Ethiopian and international law, you have the right to:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <strong>Access</strong> — request a copy of your personal data
              </li>
              <li>
                <strong>Correct</strong> — fix inaccurate data
              </li>
              <li>
                <strong>Delete</strong> — ask us to delete your data (where legally
                possible)
              </li>
              <li>
                <strong>Object</strong> — object to certain processing
              </li>
              <li>
                <strong>Export</strong> — receive your data in a portable format
              </li>
              <li>
                <strong>Withdraw consent</strong> — at any time
              </li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, email us at the address below.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">9. Security</h2>
            <p>
              We use industry-standard security: encrypted connections (HTTPS),
              Row-Level Security (RLS) on all database tables, multi-factor
              authentication for administrators, and audit logs. However, no system
              is 100% secure — please use a strong password and enable 2FA.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">10. Children</h2>
            <p>
              Moybirr is not intended for users under 18. We do not knowingly
              collect data from minors.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">
              11. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy. We will notify you of material
              changes through the app or by email.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">12. Contact Us</h2>
            <p>For privacy questions, data requests, or complaints:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                Email: <strong>ketemabiruk928@gmail.com</strong>
              </li>
              <li>
                Phone: <strong>+251963154217</strong>
              </li>
              <li>
                Address: <strong>Akaki Kality, Addis Ababa, Ethiopia</strong>
              </li>
            </ul>
          </section>
        </Card>

        <Card className="shadow-card p-4 text-xs text-muted-foreground">
          <p>
            By using Moybirr, you agree to this Privacy Policy. If you do not
            agree, please do not use the platform.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}