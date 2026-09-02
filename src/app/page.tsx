import SequenceHero from "@/components/hero/SequenceHero";
import About from "@/components/About";
import ProjectStack from "@/components/projects/ProjectStack";

export default function Home() {
  return (
    <main id="main">
      {/* Carries id="top" internally — the dock's Home link depends on it. */}
      <SequenceHero />
      <About />
      {/* Carries id="projects" internally. */}
      <ProjectStack />
      {/* Placeholder so the dock link resolves until this is built. */}
      <div id="contact" />
    </main>
  );
}