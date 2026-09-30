"use client";

import { useState } from "react";
import { hireFields, stationery } from "@light/lib/site";
import { useReducedMotion } from "@light/lib/useReducedMotion";
import Guilloche from "../../Guilloche";
import CircleChoice from "./CircleChoice";
import CodeSlots from "./CodeSlots";
import InkField from "./InkField";
import type { PaperProps } from "./paper";
import { RubberStamp } from "./Stamp";
import { useVerify } from "./useVerify";
import styles from "./Stationery.module.css";

/* ==================================================================
   ENGAGEMENT CARD — for hiring.

   A heavy engraved card, answered by circling the printed words: engage
   as a freelancer or an employee, and for which role. What it asks next
   depends on the answer:

     freelancer          a brief, and the freelance CV to take
     employee, Others    the capacity and the requirements
     employee, a role    turn the card over: verify an address, and
                         the CV written for that role comes out

   The two faces are one card turned over in 3D, so nothing on it ever
   needs to scroll. The face turned away is inert.
   ================================================================== */

const H = stationery.engagement;
const F = stationery.fields;

export type Hire = { sub: "freelance" | "employee" | null; field: string };

export default function Engagement({
    uid,
    values,
    setValue,
    errors,
    attempt,
    formRef,
    onSubmit,
    stampBox,
    hire,
    setHire,
}: PaperProps & { hire: Hire; setHire: (h: Hire) => void }) {
    const reduced = useReducedMotion();
    const [turned, setTurned] = useState(false);
    const [code, setCode] = useState("");
    const verify = useVerify();

    const role = hireFields.find((f) => f.id === hire.field);
    const isOthers = hire.field === "others";
    const needsVerify = hire.sub === "employee" && role && !isOthers;

    const pick = (next: Hire) => {
        setHire(next);
        /* A new role means a new CV: any code in flight was for the old one. */
        verify.reset();
        setCode("");
    };

    return (
        <div className={styles.engagement} data-turned={turned || undefined} data-still={reduced || undefined}>
            <div className={styles.turner}>
                {/* ---- Front ------------------------------------------- */}
                <form
                    ref={formRef}
                    className={`${styles.cardFace} ${styles.engageFront}`}
                    inert={turned}
                    noValidate
                    onSubmit={(e) => {
                        e.preventDefault();
                        onSubmit();
                    }}
                >
                    <CardFrame />
                    {hire.sub && !needsVerify && <div className={styles.stampCorner}>{stampBox}</div>}
                    <h3 className={`${styles.engageHeading} ${styles.foil}`} data-foil>{H.heading}</h3>

                    <p className={styles.printed}>{H.engageAs}</p>
                    <CircleChoice
                        label={H.engageAs}
                        options={[
                            { id: "freelance", label: H.options.freelance },
                            { id: "employee", label: H.options.employee },
                        ]}
                        value={hire.sub}
                        onChange={(sub) => pick({ sub, field: sub === "employee" ? hire.field : "" })}
                        error={!hire.sub ? errors.choice : undefined}
                    />

                    {hire.sub === "employee" && (
                        <>
                            <p className={styles.printed}>{H.forRole}</p>
                            <CircleChoice
                                label={H.forRole}
                                options={hireFields.map((f) => ({ id: f.id, label: f.label }))}
                                value={hire.field || null}
                                onChange={(field) => pick({ sub: "employee", field })}
                                error={!hire.field ? errors.choice : undefined}
                            />
                        </>
                    )}

                    {hire.sub === "freelance" && (
                        <>
                            <p className={styles.prompt}>{H.freelance.blurb}</p>
                            <CvLink href={H.freelance.resume} label={H.freelance.resumeLabel} />
                            <NameEmail uid={uid} values={values} setValue={setValue} errors={errors} attempt={attempt} />
                            <InkField
                                id={`${uid}-en-brief`}
                                name="message"
                                label={H.freelance.brief}
                                value={values.message}
                                onChange={(v) => setValue("message", v)}
                                lines={3}
                                required
                                error={errors.message}
                                attempt={attempt}
                            />
                        </>
                    )}

                    {hire.sub === "employee" && isOthers && (
                        <>
                            <InkField
                                id={`${uid}-en-capacity`}
                                name="capacity"
                                label={H.others.capacity}
                                value={values.capacity}
                                onChange={(v) => setValue("capacity", v)}
                                required
                                error={errors.capacity}
                                attempt={attempt}
                            />
                            <NameEmail uid={uid} values={values} setValue={setValue} errors={errors} attempt={attempt} />
                            <InkField
                                id={`${uid}-en-reqs`}
                                name="message"
                                label={H.others.requirements}
                                value={values.message}
                                onChange={(v) => setValue("message", v)}
                                lines={2}
                                required
                                error={errors.message}
                                attempt={attempt}
                            />
                        </>
                    )}

                    {needsVerify && (
                        <button type="button" className={styles.turnCorner} onClick={() => setTurned(true)}>
                            {H.turnOver} <span aria-hidden="true">↻</span>
                        </button>
                    )}
                    <button type="submit" hidden />
                </form>

                {/* ---- Back: verification --------------------------------- */}
                <div className={`${styles.cardFace} ${styles.engageBack}`} inert={!turned}>
                    <CardFrame />
                    <h3 className={styles.backHeading}>{H.back.heading}</h3>
                    {role && <p className={styles.printed}>{`${role.label} ${H.back.cvFor}`}</p>}

                    {verify.step === "verified" ? (
                        <div className={styles.verified}>
                            <RubberStamp text={H.back.verified} tone="green" className={styles.verifiedStamp} />
                            <div className={styles.sleeve}>
                                <CvLink href={verify.resume || role?.resume || ""} label={`${role?.label ?? ""} ${H.back.cvFor}`} />
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className={styles.prompt}>{H.back.blurb}</p>
                            <InkField
                                id={`${uid}-en-vemail`}
                                name="email"
                                type="email"
                                label={H.back.email}
                                value={values.email}
                                onChange={(v) => {
                                    setValue("email", v);
                                    if (verify.step === "code") {
                                        verify.reset();
                                        setCode("");
                                    }
                                }}
                                autoComplete="email"
                            />
                            {verify.step === "code" || verify.step === "checking" ? (
                                <>
                                    <CodeSlots id={`${uid}-en-code`} label={H.back.code} value={code} onChange={setCode} />
                                    <div className={styles.backActions}>
                                        <button
                                            type="button"
                                            className={`${styles.pill} ink`}
                                            disabled={verify.step === "checking" || code.length < 6}
                                            onClick={() => verify.confirm(values.email, code, hire.field)}
                                        >
                                            {verify.step === "checking" ? `${H.back.confirming}…` : H.back.confirm}
                                        </button>
                                        <button type="button" className={styles.textButton} onClick={() => verify.request(values.email)}>
                                            {H.back.resend}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className={styles.backActions}>
                                    <button
                                        type="button"
                                        className={`${styles.pill} ink`}
                                        disabled={verify.step === "sending" || !values.email}
                                        onClick={() => verify.request(values.email)}
                                    >
                                        {verify.step === "sending" ? `${H.back.requesting}…` : H.back.request}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                    <p className={styles.status} data-error role="status" aria-live="polite">
                        {verify.error}
                    </p>
                    <button type="button" className={styles.turnCorner} onClick={() => setTurned(false)}>
                        <span aria-hidden="true">↺</span> {H.turnBack}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* The engraving: a ruled double border with a rosette at its head. */
function CardFrame() {
    return (
        <span className={styles.frame} aria-hidden="true">
            <Guilloche preset="seal" size={46} className={styles.frameRosette} />
        </span>
    );
}

function NameEmail({
    uid,
    values,
    setValue,
    errors,
    attempt,
}: Pick<PaperProps, "uid" | "values" | "setValue" | "errors" | "attempt">) {
    return (
        <div className={styles.pair}>
            <InkField
                id={`${uid}-en-name`}
                name="name"
                label={F.name}
                value={values.name}
                onChange={(v) => setValue("name", v)}
                autoComplete="name"
                required
                error={errors.name}
                attempt={attempt}
            />
            <InkField
                id={`${uid}-en-email`}
                name="email"
                type="email"
                label={F.email}
                value={values.email}
                onChange={(v) => setValue("email", v)}
                autoComplete="email"
                required
                error={errors.email}
                attempt={attempt}
            />
        </div>
    );
}

/* A CV, as a document tab to take. An unset path says so rather than
   linking to a 404 (see hireFields in src/shared/contact.ts). */
function CvLink({ href, label }: { href: string; label: string }) {
    if (!href) return <p className={styles.cvPending}>{label}: not added yet.</p>;
    return (
        <a
            className={`${styles.cv} ink`}
            href={href}
            /* Renames the file on the way out: the PDFs keep their working
               names, and a "-1" in a downloaded CV looks like a draft. */
            download={`Ambud Lahiri, ${label.trim()}.pdf`}
            rel="noreferrer"
        >
            <span aria-hidden="true">↓</span> {label}
        </a>
    );
}
