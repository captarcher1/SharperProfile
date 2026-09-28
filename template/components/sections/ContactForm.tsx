"use client";

import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import type { ContactFormData } from "@/config/types";
import { config } from "@/config/site";
import LinkedinIcon from "@/components/icons/LinkedinIcon";

type Status = "idle" | "submitting" | "success" | "error";

const WEB3FORMS_ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY;

export default function ContactForm({ id, data }: { id: string; data: ContactFormData }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const visitorName = String(formData.get("name") || "").trim() || "Someone";
    formData.set("subject", `New message from ${visitorName} via ${config.name}'s site`);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });
      const responseData = await response.json();

      if (responseData.success) {
        setStatus("success");
        form.reset();
      } else {
        setStatus("error");
        setErrorMessage(responseData.message || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Could not reach the form service. Please try again.");
    }
  }

  return (
    <section id={id} className="border-t border-border bg-surface">
      <div className="mx-auto max-w-[1200px] px-5 py-11 sm:px-8 md:py-14">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
          <div>
            <h2 className="text-2xl font-semibold text-ink-navy sm:text-3xl">{data.heading}</h2>
            {data.supportingCopy && (
              <p className="mt-4 max-w-[50ch] text-sm leading-relaxed text-ink-body">
                {data.supportingCopy}
              </p>
            )}
            {data.socialLink && (
              <a
                href={data.socialLink.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink-navy hover:text-accent"
              >
                <LinkedinIcon size={18} />
                {data.socialLink.label}
              </a>
            )}
          </div>

          {WEB3FORMS_ACCESS_KEY ? (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <input type="hidden" name="access_key" value={WEB3FORMS_ACCESS_KEY} />
              {/* Honeypot spam trap — must stay in the DOM but hidden from real users */}
              <input
                type="checkbox"
                name="botcheck"
                className="hidden"
                style={{ display: "none" }}
                tabIndex={-1}
                aria-hidden="true"
              />

              <div>
                <label htmlFor="name" className="sr-only">Name</label>
                <input
                  id="name"
                  name="name"
                  required
                  placeholder="Name"
                  className="h-12 w-full rounded-[10px] border border-border bg-background px-4 text-sm text-ink-body outline-none focus-visible:border-accent"
                />
              </div>
              <div>
                <label htmlFor="email" className="sr-only">Email</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  placeholder="Email"
                  className="h-12 w-full rounded-[10px] border border-border bg-background px-4 text-sm text-ink-body outline-none focus-visible:border-accent"
                />
              </div>
              <div>
                <label htmlFor="message" className="sr-only">Message</label>
                <textarea
                  id="message"
                  name="message"
                  required
                  placeholder="Message"
                  rows={5}
                  className="w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm text-ink-body outline-none focus-visible:border-accent"
                />
              </div>

              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex h-12 items-center justify-center rounded-full bg-ink-navy px-6 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
              >
                {status === "submitting" ? "Sending…" : "Send message"}
              </button>

              {status === "success" && (
                <p className="text-sm font-medium text-accent" role="status">
                  Thanks — your message has been sent.
                </p>
              )}
              {status === "error" && (
                <p className="text-sm font-medium text-red-600" role="alert">
                  {errorMessage}
                </p>
              )}
              {data.privacyNote && (
                <p className="text-xs leading-relaxed text-ink-muted">{data.privacyNote}</p>
              )}
            </form>
          ) : (
            // No NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY configured — fall back to a
            // plain mailto: link instead of shipping a non-functional form.
            <div className="flex flex-col items-start justify-center gap-4 rounded-[16px] border border-border bg-background p-6 sm:p-7">
              <p className="text-sm leading-relaxed text-ink-body">
                No contact form is configured yet. Set{" "}
                <code className="rounded bg-surface px-1.5 py-0.5 text-xs">
                  NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY
                </code>{" "}
                in <code className="rounded bg-surface px-1.5 py-0.5 text-xs">.env.local</code>{" "}
                (see <code className="rounded bg-surface px-1.5 py-0.5 text-xs">CONFIGURING.md</code>),
                or just email directly:
              </p>
              {config.social.email && (
                <a
                  href={`mailto:${config.social.email}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink-navy px-6 text-sm font-medium text-white transition-colors hover:bg-accent"
                >
                  <Mail size={18} />
                  {config.social.email}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
