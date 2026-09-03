"use client";

import { useId, useState } from "react";
import { contactForm, hireFields } from "@/lib/site";
import SubmitButton from "./SubmitButton";
import styles from "./ContactForm.module.css";

const { freelance, employee } = contactForm.hire;

type Sub = "freelance" | "employee";

/* The verification flow, as a state machine rather than a pile of booleans —
   "sending" and "verified" are mutually exclusive and a boolean pair would let
   both be true at once. */
type VerifyStep = "idle" | "sending" | "code" | "checking" | "verified";

export default function HirePanel({
    values,
    setValue,
    onSend,
    pending,
    result,
}: {
    values: Record<string, string>;
    setValue: (key: string, value: string) => void;
    onSend: (extra: Record<string, string>) => void;
    pending: boolean;
    result: { ok: boolean; message: string } | null;
}) {
    const uid = useId();
    const [sub, setSub] = useState<Sub>("freelance");

    return (
        <div className={styles.panelBody}>
            {/* Radio semantics, not tabs-within-tabs. These two swap the form
                you are filling in rather than paging through content, and
                nesting a second tablist inside the first is a maze to navigate
                by keyboard. */}
            <div
                className={styles.subTabs}
                role="radiogroup"
                aria-label="How you would be hiring"
            >
                {(["freelance", "employee"] as const).map((id) => (
                    <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={sub === id}
                        className={styles.subTab}
                        data-active={sub === id || undefined}
                        onClick={() => setSub(id)}
                    >
                        {id === "freelance" ? freelance.label : employee.label}
                    </button>
                ))}
            </div>

            {sub === "freelance" ? (
                <FreelancePanel
                    uid={uid}
                    values={values}
                    setValue={setValue}
                    onSend={onSend}
                    pending={pending}
                    result={result}
                />
            ) : (
                <EmployeePanel
                    uid={uid}
                    values={values}
                    setValue={setValue}
                    onSend={onSend}
                    pending={pending}
                    result={result}
                />
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */

function FreelancePanel({
    uid,
    values,
    setValue,
    onSend,
    pending,
    result,
}: {
    uid: string;
    values: Record<string, string>;
    setValue: (k: string, v: string) => void;
    onSend: (extra: Record<string, string>) => void;
    pending: boolean;
    result: { ok: boolean; message: string } | null;
}) {
    return (
        <>
            <p className={styles.blurb}>{freelance.blurb}</p>

            <ResumeLink href={freelance.resume} label={freelance.resumeLabel} />

            <form
                className={styles.form}
                onSubmit={(e) => {
                    e.preventDefault();
                    onSend({ kind: "freelance" });
                }}
            >
                <NameEmail uid={uid} values={values} setValue={setValue} />
                <Field
                    id={`${uid}-brief`}
                    name="message"
                    label="Project brief"
                    value={values.message}
                    onChange={(v) => setValue("message", v)}
                    textarea
                    required
                />
                <Actions pending={pending} result={result} />
            </form>
        </>
    );
}

/* ------------------------------------------------------------------ */

function EmployeePanel({
    uid,
    values,
    setValue,
    onSend,
    pending,
    result,
}: {
    uid: string;
    values: Record<string, string>;
    setValue: (k: string, v: string) => void;
    onSend: (extra: Record<string, string>) => void;
    pending: boolean;
    result: { ok: boolean; message: string } | null;
}) {
    const [field, setField] = useState<string>("");
    const [step, setStep] = useState<VerifyStep>("idle");
    const [token, setToken] = useState("");
    const [code, setCode] = useState("");
    const [resume, setResume] = useState("");
    const [error, setError] = useState("");

    const chosen = hireFields.find((f) => f.id === field);
    const isOthers = field === "others";

    const requestCode = async () => {
        setError("");
        setStep("sending");
        try {
            const res = await fetch("/api/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "request", email: values.email }),
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
    };

    const confirmCode = async () => {
        setError("");
        setStep("checking");
        try {
            const res = await fetch("/api/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "confirm",
                    email: values.email,
                    code,
                    token,
                    field,
                }),
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
    };

    return (
        <>
            <p className={styles.blurb}>{employee.blurb}</p>

            <fieldset className={styles.fieldset}>
                <legend className={styles.legend}>{employee.question}</legend>
                <div className={styles.chips}>
                    {hireFields.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            role="radio"
                            aria-checked={field === f.id}
                            className={styles.chip}
                            data-active={field === f.id || undefined}
                            onClick={() => {
                                setField(f.id);
                                /* Changing the field invalidates a verification
                                   done for a different one — the code was bound
                                   to an address, but the CV it unlocks was not. */
                                setStep("idle");
                                setCode("");
                                setToken("");
                                setResume("");
                                setError("");
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </fieldset>

            {/* ---- Others: no CV to gate, so no gate ------------------- */}
            {isOthers && (
                <form
                    className={styles.form}
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSend({ kind: "hire", field: "Others" });
                    }}
                >
                    <p className={styles.note}>{employee.othersNote}</p>
                    <Field
                        id={`${uid}-capacity`}
                        name="capacity"
                        label={employee.othersLabel}
                        value={values.capacity}
                        onChange={(v) => setValue("capacity", v)}
                        required
                    />
                    <NameEmail uid={uid} values={values} setValue={setValue} />
                    <Field
                        id={`${uid}-reqs`}
                        name="message"
                        label="Job requirements"
                        value={values.message}
                        onChange={(v) => setValue("message", v)}
                        textarea
                        required
                    />
                    <Actions pending={pending} result={result} />
                </form>
            )}

            {/* ---- One of the four: verify, then download -------------- */}
            {chosen && !isOthers && (
                <div className={styles.verify}>
                    {step !== "verified" && (
                        <p className={styles.blurb}>{employee.verifyBlurb}</p>
                    )}

                    {step === "verified" ? (
                        <>
                            <p className={styles.verified}>
                                Verified. Here is the CV for {chosen.label}.
                            </p>
                            <ResumeLink
                                href={resume || chosen.resume}
                                label={`${chosen.label} CV`}
                            />
                        </>
                    ) : (
                        <>
                            <Field
                                id={`${uid}-vemail`}
                                name="email"
                                label={contactForm.fields.email}
                                type="email"
                                value={values.email}
                                onChange={(v) => {
                                    setValue("email", v);
                                    /* A token is bound to the address it was
                                       issued for, so editing the address has to
                                       throw the code away rather than leave a
                                       stale one that will only fail later. */
                                    if (step === "code") {
                                        setStep("idle");
                                        setCode("");
                                        setToken("");
                                    }
                                }}
                                required
                            />

                            {step === "code" || step === "checking" ? (
                                <>
                                    <Field
                                        id={`${uid}-code`}
                                        name="code"
                                        label="Six-digit code"
                                        value={code}
                                        onChange={setCode}
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        required
                                    />
                                    <div className={styles.actions}>
                                        <button
                                            type="button"
                                            className={styles.submit}
                                            onClick={confirmCode}
                                            disabled={
                                                step === "checking" || code.length < 6
                                            }
                                        >
                                            <span className={styles.sweep} aria-hidden="true" />
                                            <span className={styles.submitLabel}>
                                                {step === "checking"
                                                    ? "Checking…"
                                                    : "Verify"}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.ghost}
                                            onClick={requestCode}
                                        >
                                            Resend code
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className={styles.actions}>
                                    <button
                                        type="button"
                                        className={styles.submit}
                                        onClick={requestCode}
                                        disabled={step === "sending" || !values.email}
                                    >
                                        <span className={styles.sweep} aria-hidden="true" />
                                        <span className={styles.submitLabel}>
                                            {step === "sending"
                                                ? "Sending…"
                                                : "Send me a code"}
                                        </span>
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    <p className={styles.status} role="status" aria-live="polite">
                        {error}
                    </p>
                </div>
            )}
        </>
    );
}

/* ------------------------------------------------------------------
   Shared bits
   ------------------------------------------------------------------ */

function ResumeLink({ href, label }: { href: string; label: string }) {
    /* An unset link renders as a disabled control that says so, rather than a
       live anchor pointing at a 404. See the `resume: ""` convention in
       site.ts — filling those in is all that is needed to switch this on. */
    if (!href) {
        return (
            <p className={styles.resumePending}>
                {label} — link not added yet.
            </p>
        );
    }
    return (
        <a
            className={styles.resume}
            href={href}
            /* Renames the file on the way out. The PDFs are stored under their
               working names — Ambud_Resume_SDE-1.pdf and so on — and a "-1" in
               a downloaded CV looks like a draft that got sent by mistake. */
            download={`Ambud Lahiri — ${label}.pdf`}
            /* No target="_blank" alongside download. The two contradict each
               other: the browser opens a tab, starts the download, then leaves
               the blank tab behind. */
            rel="noreferrer"
        >
            <span aria-hidden="true">↓</span> {label}
        </a>
    );
}

function NameEmail({
    uid,
    values,
    setValue,
}: {
    uid: string;
    values: Record<string, string>;
    setValue: (k: string, v: string) => void;
}) {
    return (
        <div className={styles.row}>
            <Field
                id={`${uid}-name`}
                name="name"
                label={contactForm.fields.name}
                value={values.name}
                onChange={(v) => setValue("name", v)}
                autoComplete="name"
                required
            />
            <Field
                id={`${uid}-email`}
                name="email"
                label={contactForm.fields.email}
                type="email"
                value={values.email}
                onChange={(v) => setValue("email", v)}
                autoComplete="email"
                required
            />
        </div>
    );
}

function Actions({
    pending,
    result,
}: {
    pending: boolean;
    result: { ok: boolean; message: string } | null;
}) {
    return (
        <div className={styles.actions}>
            <SubmitButton label={contactForm.submit} pending={pending} />
            <p
                className={styles.status}
                data-error={result && !result.ok ? true : undefined}
                role="status"
                aria-live="polite"
            >
                {result?.message ?? ""}
            </p>
        </div>
    );
}

export function Field({
    id,
    label,
    value,
    onChange,
    textarea,
    type = "text",
    ...rest
}: {
    id: string;
    label: string;
    value: string;
    onChange: (v: string) => void;
    textarea?: boolean;
    type?: string;
} & Omit<
    React.InputHTMLAttributes<HTMLInputElement> &
        React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    "id" | "value" | "onChange" | "type"
>) {
    return (
        <div className={styles.field}>
            {/* Real labels, not placeholders — a placeholder vanishes the moment
                someone types, leaving no way to check what a half-filled field
                was for, and it is not reliably announced by screen readers. */}
            <label className={styles.label} htmlFor={id}>
                {label}
            </label>
            {textarea ? (
                <textarea
                    id={id}
                    className={`${styles.input} ${styles.textarea}`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={4}
                    {...rest}
                />
            ) : (
                <input
                    id={id}
                    className={styles.input}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    {...rest}
                />
            )}
        </div>
    );
}
