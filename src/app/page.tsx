import Hero from "@/components/Hero";
import DockNav from "@/components/Docknav";

export default function Home() {
  return (
    <>
      <main id="main">
        <Hero />
        {/* Placeholders so the dock links already resolve.
            Replace each with its real section as we build it. */}
        <div id="about" />
        <div id="projects" />
        <div id="contact" />
      </main>
      <DockNav />
    </>
  );
}