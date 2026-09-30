"use client";

import { useCallback, useState } from "react";

/* ==================================================================
   VERIFYING — the engagement card's back: a code to the visitor's
   address, then the CV for the role they chose.

   A state machine rather than a pile of booleans: "sending" and
   "verified" are mutually exclusive, and a boolean pair would let both be
   true at once. Same /api/verify contract as before.
   ================================================================== */

export type VerifyStep = "idle" | "sending" | "code" | "checking" | "verified";

export function useVerify() {
    const [step, setStep] = useState<VerifyStep>("idle");
    const [token, setToken] = useState("");
    const [resume, setResume] = useState("");
    const [error, setError] = useState("");

    /* Changing the address or the role throws a code away: a token is bound
       to the address it was issued for, and the CV it unlocks to the role. */
    const reset = useCallback(() => {
        setStep("idle");
        setToken("");
        setResume("");
        setError("");
    }, []);

    const request = useCallback(async (email: string) => {
        setError("");
        setStep("sending");
        try {
            const res = await fetch("/api/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "request", email }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error ?? "Could not send the code.");
                setStep("idle");
                return;
            }
            setToken(data.token);
            setStep("code");
        } catch {
            setError("Network error. Please try again.");
            setStep("idle");
        }
    }, []);

    const confirm = useCallback(
        async (email: string, code: string, field: string) => {
            setError("");
            setStep("checking");
            try {
                const res = await fetch("/api/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "confirm", email, code, token, field }),
                });
                const data = await res.json();
                if (!res.ok) {
                    setError(data.error ?? "That code is not right.");
                    setStep("code");
                    return;
                }
                setResume(data.resume ?? "");
                setStep("verified");
            } catch {
                setError("Network error. Please try again.");
                setStep("code");
            }
        },
        [token],
    );

    return { step, resume, error, request, confirm, reset };
}
