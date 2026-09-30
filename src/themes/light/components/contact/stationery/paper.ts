import type { ReactNode, RefObject } from "react";
import { stationery } from "@light/lib/site";
import type { Values } from "./useContactSend";

/* What the desk hands every paper. */
export type PaperProps = {
    uid: string;
    values: Values;
    setValue: (k: keyof Values, v: string) => void;
    errors: Errors;
    attempt: number;
    /* The paper's form, so the desk can check it before a send. */
    formRef?: RefObject<HTMLFormElement | null>;
    onSubmit: () => void;
    /* The box the stamp goes in, placed by the paper where its kind of
       stationery keeps it. Absent on a paper flying home. */
    stampBox?: ReactNode;
};

export type Errors = Partial<Record<keyof Values | "choice", string>>;

const E = stationery.errors;

/* The margin notes for a form's fields, from the browser's own checks
   (required, type="email"), so the rules live on the inputs. */
export function check(form: HTMLFormElement): Errors {
    const out: Errors = {};
    form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input[name], textarea[name]").forEach((el) => {
        if (el.validity.valid) return;
        const name = el.name as keyof Values;
        if (name === "email") out.email = el.validity.typeMismatch ? E.emailInvalid : E.email;
        else if (name === "name") out.name = E.name;
        else if (name === "capacity") out.capacity = E.capacity;
        else out.message = E.message;
    });
    return out;
}
