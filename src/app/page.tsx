import SequenceHero from "@/components/hero/SequenceHero";
import About from "@/components/About";
import ProjectStack from "@/components/projects/ProjectStack";
import Seam from "@/components/scene/Seam";
import ContactSequence from "@/components/contact/ContactSequence";
import Footer from "@/components/footer/Footer";

export default function Home() {
  return (
    <>
      <main id="main">
        {/* Carries id="top" internally — the dock's Home link depends on it. */}
        <SequenceHero />
        <Seam />
        <About />
        {/* Carries id="projects" internally. */}
        <Seam />
        <ProjectStack />
        {/* Carries id="contact" internally. */}
        <Seam />
        <ContactSequence />
      </main>
      {/* Outside <main> on purpose. A <footer> that is not nested in <main> is
          the page's contentinfo landmark; inside it, it would be demoted to a
          plain section footer. */}
      <Footer />
    </>
  );
}