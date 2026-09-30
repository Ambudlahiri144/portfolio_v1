"use client";

import { useCallback, useState } from "react";

/* ==================================================================
   SENDING — what every paper posts to /api/contact.

   The request is the one the tabbed form sent before it: the shared
   values plus the paper's `kind` (feedback, connect, freelance, hire)
   and anything extra it asks (a hiring field). The server is unchanged.
   ================================================================== */

export type Values = {
    name: string;
    email: string;
    topic: string;
    message: string;
    capacity: string;
};

export const EMPTY: Values = { name: "", email: "", topic: "", message: "", capacity: "" };

export type SendResult = { ok: true } | { ok: false; message: string };

export function useContactSend() {
    const [pending, setPending] = useState(false);

    const send = useCallback(async (values: Values, extra: Record<string, string>): Promise<SendResult> => {
        setPending(true);
        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...values, ...extra }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return { ok: false, message: data.error ?? "Could not send that." };
            return { ok: true };
        } catch {
            return { ok: false, message: "Network error. Please try again." };
        } finally {
            setPending(false);
        }
    }, []);

    return { send, pending };
}
