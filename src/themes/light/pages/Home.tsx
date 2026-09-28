import Book from "@light/components/book/Book";

/* The light theme's home page is one book, read by scrolling: the cover,
   the open spreads, and the closed book with the colophon beside it. The
   ids the dock and footer jump to (#top, #about, #work, #projects,
   #contact) are placed inside it at each spread's resting point. */
export default function Home() {
    return (
        <main id="main">
            <Book />
        </main>
    );
}
