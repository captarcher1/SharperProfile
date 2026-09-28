import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SectionRenderer from "@/components/layout/SectionRenderer";
import { config } from "@/config/site";

// Thin by design: this loops over config.sections instead of hand-assembling
// markup, so adding/removing/renaming/reordering a section is a config edit,
// never a code edit.
export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        {config.sections.map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}
      </main>
      <Footer />
    </>
  );
}
