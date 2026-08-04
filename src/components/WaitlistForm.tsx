"use client";

import { useState, type FormEvent } from "react";

export function WaitlistForm({
  variant,
  defaultNote,
}: {
  variant?: "cta";
  defaultNote: string;
}) {
  const [note, setNote] = useState(defaultNote);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    if (!email) return;

    setNote(`Thanks — we'll email ${email} when Café Sonne launches.`);
    setSuccess(true);
    form.reset();

    setTimeout(() => {
      setNote(defaultNote);
      setSuccess(false);
    }, 6000);
  }

  const formClass = variant === "cta" ? "waitlist-form waitlist-form--cta" : "waitlist-form";
  const noteClass = `form-note ${variant === "cta" ? "center" : ""} ${success ? "success" : ""}`.trim();

  return (
    <>
      <form className={formClass} onSubmit={handleSubmit}>
        <input
          type="email"
          name="email"
          placeholder="you@email.com"
          required
          aria-label="Email address"
        />
        <button type="submit" className="btn btn-primary">
          Join the waitlist
        </button>
      </form>
      <p className={noteClass}>{note}</p>
    </>
  );
}
