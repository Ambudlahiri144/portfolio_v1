import Hero from "@/components/Hero";
import About from "@/components/About";

export default function Home() {
  return (
    <main id="main">
      <Hero />
      <About />
      {/* Placeholders so the dock links resolve until these are built. */}
      <div id="projects" />
      <div id="contact" />
    </main>
  );
}