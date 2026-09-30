import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader, AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: "Terms of Service — Moybirr" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <AppShell>
      <AppHeader
        title="Terms of Service"
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
            <h2 className="mb-2 text-base font-semibold">1. Acceptance</h2>
            <p>
              By using Moybirr, you agree to these Terms of Service. If you do not
              agree, please do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">
              2. Who Can Use Moybirr
            </h2>
            <p>
              You must be at least 18 years old and legally able to enter into
              contracts. Hotel owners must have a valid Ethiopian business license.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">3. Your Account</h2>
            <p>
              You are responsible for keeping your login credentials secure and for
              all activity under your account. Notify us immediately of any
              unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">
              4. Payments and Tipping
            </h2>
            <ul className="ml-4 list-disc space-y-1">
              <li>All payments are processed through Chapa and partner banks.</li>
              <li>
                Tips go 100% to the staff member; Moybirr takes no cut of tips.
              </li>
              <li>
                A 1% commission applies to eligible service bill transactions.
              </li>
              <li>
                All amounts are in Ethiopian Birr (ETB) unless stated otherwise.
              </li>
              <li>
                Refunds follow the applicable hotel's policy and Chapa's terms.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">5. Payroll</h2>
            <p>
              Moybirr calculates payroll according to Ethiopian tax and pension law
              as of the date of calculation. Tax rules may change. Hotel owners are
              responsible for verifying final payroll figures with a qualified
              Ethiopian accountant before payment.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">6. Acceptable Use</h2>
            <p>You agree NOT to:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Post false, misleading, or defamatory content</li>
              <li>Harass, threaten, or abuse other users</li>
              <li>
                Attempt to hack, scrape, or reverse-engineer the platform
              </li>
              <li>
                Use Moybirr for illegal activity, including tax evasion or fraud
              </li>
              <li>Upload malware or attempt to disrupt the service</li>
              <li>Impersonate another person or business</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">
              7. Content You Post
            </h2>
            <p>
              You keep ownership of content you post (photos, reviews, messages).
              By posting, you grant Moybirr a non-exclusive license to display that
              content on the platform.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">
              8. Suspension and Termination
            </h2>
            <p>
              We may suspend or terminate accounts that violate these terms, with or
              without notice, depending on the severity of the violation.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">
              9. Limitation of Liability
            </h2>
            <p>
              Moybirr is provided "as is". We are not liable for indirect,
              incidental, or consequential damages arising from use of the
              platform, to the maximum extent allowed by Ethiopian law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">10. Governing Law</h2>
            <p>
              These terms are governed by the laws of the Federal Democratic
              Republic of Ethiopia. Disputes will be resolved in the courts of
              Addis Ababa.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold">11. Contact</h2>
            <p>
              Questions? Email <strong>ketemabiruk928@gmail.com</strong> or call{" "}
              <strong>+251963154217</strong>.
            </p>
            <p className="mt-1">
              Address: <strong>Akaki Kality, Addis Ababa, Ethiopia</strong>
            </p>
          </section>
        </Card>
      </div>
    </AppShell>
  );
}