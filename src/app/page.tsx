import Journey from "@/components/journey/Journey";
import ProjectStack from "@/components/projects/ProjectStack";
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
        {/* NO SEAM HERE ANY MORE. Journey ends by turning the screen
            black square by square (PixelWipe), and Contact opens on that
            same black and lights up out of it — so the join is already a
            cut to black, and a haze band laid over it would only muddy
            it. Contact must follow Journey DIRECTLY: the wipe's overlay
            hides at the exact moment the track's bottom edge reaches the
            top of the window, which is only Contact's first pixel if
            nothing sits between them. Under reduced motion there is no
            wipe, and Journey's held branch brings its own seam. */}
        <Contact />
      </main>
      {/* Outside <main> on purpose. A <footer> that is not nested in <main> is
          the page's contentinfo landmark; inside it, it would be demoted to a
          plain section footer. */}
      <Footer />
    </>
  );
}