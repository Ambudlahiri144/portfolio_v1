import Journey from "@/components/journey/Journey";
import ProjectStack from "@/components/projects/ProjectStack";
import Seam from "@/components/scene/Seam";
import Contact from "@/components/contact/Contact";
import Footer from "@/components/footer/Footer";

export default function Home() {
  return (
    <>
      <main id="main">
        {/* The hero, the camera move into About, About itself, and the
            second move out over the valley — one pinned surface carrying
            id="top" and id="about". They are not four sections stacked in
            a column, deliberately: see the header comment in Journey.tsx.

            PROJECTS IS NESTED, AND THERE IS NO SEAM BEFORE IT. The camera
            comes to rest on the valley and stays there, pinned, while
            Projects arrives on top of that same picture — so there is no
            join left to soften. A seam here would be a band of haze laid
            across one continuous photograph, and its -23svh block margins
            would pull the pinned wrapper around as well.

            Projects still carries id="projects" and is still an ordinary
            section in the flow of this page; it is just carried by that
            surface rather than following it. */}
        <Journey>
          <ProjectStack />
        </Journey>
        {/* Carries id="contact" internally. Tinted to the temple night's
            own clear colour rather than to --bg, for the same reason the
            Projects seams are: the section below is a fixed dark world in
            both themes, so a --bg band would be the only light thing on
            screen at exactly the join meant to soften it. */}
        <Seam tint="#1E1936" />
        <Contact />
      </main>
      {/* Outside <main> on purpose. A <footer> that is not nested in <main> is
          the page's contentinfo landmark; inside it, it would be demoted to a
          plain section footer. */}
      <Footer />
    </>
  );
}