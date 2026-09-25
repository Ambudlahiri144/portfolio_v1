"use client";

import { useCallback, useState } from "react";

/* ==================================================================
   THE FORM'S STATE, OWNED ABOVE THE FORM

   This used to live inside ContactForm, which was one card with three
   tabs. Contact is now a choice game: the visitor picks Feedback, Connect
   or Hire me, and only that one form is shown — and they can go back and
   pick another. The state therefore has to outlive any one form, or a
   change of mind would throw away the name, email and paragraph they had
   already typed. So it is lifted here and owned by Contact.

   Name and email are the same person whichever form they are on; asking
   twice would be rude.
   ================================================================== */

export type Values = {
    name: string;
    email: string;
    topic: string;
    message: string;
    capacity: string;
};

export type Result = { ok: boolean; message: string } | null;

export type ContactFormState = {
    values: Values;
    setValue: (key: string, value: string) => void;
    send: (extra: Record<string, string>) => Promise<void>;
    pending: boolean;
    result: Result;
};

const EMPTY: Values = { name: "", email: "", topic: "", message: "", capacity: "" };

export function useContactForm(): ContactFormState {
    const [values, setValues] = useState<Values>(EMPTY);
    const [pending, setPending] = useState(false);
    const [result, setResult] = useState<Result>(null);

    const setValue = useCallback((key: string, value: string) => {
        setValues((v) => ({ ...v, [key]: value }));
        /* Any edit clears the last outcome. Leaving "Sent" sitting above a
           form someone is retyping reads as though the new one has already
           gone too. */
        setResult(null);
    }, []);

    const send = useCallback(
        async (extra: Record<string, string>) => {
            setPending(true);
            setResult(null);
            try {
                const res = await fetch("/api/contact", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...values, ...extra }),
                });
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    setResult({ ok: false, message: data.error ?? "Could not send that." });
                    return;
                }

                setResult({ ok: true, message: "Sent — thank you." });
                /* Keep name and email; clear what was actually said. */
                setValues((v) => ({ ...v, topic: "", message: "", capacity: "" }));
            } catch {
                setResult({ ok: false, message: "Network error. Please try again." });
            } finally {
                setPending(false);
            }
        },
        [values],
    );

    return { values, setValue, send, pending, result };
}
