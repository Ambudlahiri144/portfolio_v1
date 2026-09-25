import VideoHero from "@light/components/hero/VideoHero";
import AboutSequence from "@light/components/about/AboutSequence";
import ProjectStack from "@light/components/projects/ProjectStack";
import ContactSequence from "@light/components/contact/ContactSequence";
import Footer from "@light/components/footer/Footer";

export default function Home() {
  return (
    <>
      <main id="main">
        {/* Carries id="top" internally — the dock's Home link and the footer's
            back-to-top both depend on it. */}
        <VideoHero />
        {/* Carries id="about" internally. This is the scrubbed frame sequence
            that used to open the page; it is the About section now, and the
            separate About block it sat above is gone. */}
        <AboutSequence />
        {/* Carries id="projects" internally. */}
        <ProjectStack />
        {/* Carries id="contact" internally. */}
        <ContactSequence />
      </main>
      {/* Outside <main> on purpose. A <footer> that is not nested in <main> is
          the page's contentinfo landmark; inside it, it would be demoted to a
          plain section footer. */}
      <Footer />
    </>
  );
}
