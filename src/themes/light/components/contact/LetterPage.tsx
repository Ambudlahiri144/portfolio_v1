"use client";

import { useState } from "react";
import ContactForm, { type SentLetter } from "./ContactForm";
import Envelope from "./Envelope";

/* The contact page of the book: the form, until something is sent; then
   the letter folds into its envelope and goes, and the page offers to
   take another.

   The form stays mounted (hidden) while the envelope plays, so it keeps
   the sender's name and email: "Write another" really is just another
   letter. */
export default function LetterPage() {
    const [sent, setSent] = useState<SentLetter | null>(null);

    return (
        <>
            <div hidden={!!sent} style={{ height: "100%" }}>
                <ContactForm onSent={setSent} />
            </div>
            {sent && <Envelope letter={sent} onAgain={() => setSent(null)} />}
        </>
    );
}
