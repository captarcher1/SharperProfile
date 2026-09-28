// In-tool help page (2026-09-27) — the wizard's own README already has a
// complete, accurate user-facing section (everything above its "Engineering
// build log" divider), but it's only reachable by opening the project folder
// in a text/markdown viewer, not from inside the running tool. Pranay asked
// to keep both rather than replace one with the other, so this page mirrors
// that same content for anyone who's already got the wizard open in a
// browser — with the two stale "not built yet" callouts about Vercel
// publishing corrected here, since B9/B10 are now live-verified. The README
// itself is left exactly as-is; updating its own stale TODOs is a separate,
// already-tracked cleanup item, not bundled into this change.
//
// 2026-09-28 — "Getting started" rewritten again: double-click launchers
// (`Start SharperProfile.bat` / `.command`, `start.sh`) now handle
// `npm install` + `npm run dev` + opening the browser, so a first-time user
// never has to open a terminal or manually paste a localhost link. See
// `Start SharperProfile.bat`'s own header comment for exactly what it does
// and why it's a plain-text script rather than a compiled .exe.
//
// Not one of the 4 numbered wizard steps, so it doesn't render <WizardSteps>
// — this is reference material, not a step to complete. Reuses the same
// .page/.card/.lede classes every other wizard page already uses; no new
// design system, per the redesign question being parked as ideas-only.
import Link from "next/link";

export default function WizardHelpPage() {
  return (
    <main className="page">
      <h1>Help</h1>
      <p className="lede">
        What this tool does, where your data goes, and how to get from a résumé to a live website.
      </p>

      <div className="card">
        <h2>What this is, in plain English</h2>
        <p>
          You give this tool your résumé. It reads through it, pulls out your experience, skills, and story, and —
          using an AI model you choose and connect yourself — turns that into the content for a clean, professional
          portfolio website. When you&apos;re ready, you publish that website live with your own Vercel account, so
          you have a real link you can share with employers, clients, or anyone else.
        </p>
        <p>
          This tool runs on <strong>your own computer</strong>. It isn&apos;t a website you log into — it&apos;s a
          small program you download and run yourself, the same general idea as installing any other desktop tool.
          That&apos;s a deliberate choice, and it&apos;s the reason the next section can make the promises it makes.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/help/how-it-works.svg"
          alt="How it works: your résumé goes into the tool running on your computer, which builds your portfolio website"
          style={{ maxWidth: "100%", height: "auto", marginTop: 8 }}
        />
      </div>

      <div className="card">
        <h2>Is this safe? Do my information and API keys leave my computer?</h2>
        <p>
          Short answer: your résumé, your AI provider key, and your Vercel details never go to us, and never touch
          any server we operate. Here&apos;s exactly where things go instead — and because this project is open
          source, you (or anyone technical you trust) can read the actual code and check this yourself, rather than
          just taking our word for it.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/help/where-keys-go.svg"
          alt="Where your keys actually go: from your computer directly to your chosen AI provider and to Vercel, never to the developer's servers"
          style={{ maxWidth: "100%", height: "auto", marginBottom: 12 }}
        />
        <ul>
          <li>
            <strong>Your résumé</strong> is read locally by the tool on your machine, then sent only to the AI
            provider you chose — the same as if you&apos;d pasted it into that provider&apos;s own website yourself.
          </li>
          <li>
            <strong>Your AI provider key</strong> is used only to talk to that provider, directly from your
            computer. It&apos;s saved in a local settings file (<code>.env.local</code>) so you don&apos;t have to
            re-type it every time. That file is already excluded from anything that gets uploaded to GitHub, so it
            won&apos;t get shared by accident even if you push your own copy of this project online.
          </li>
          <li>
            <strong>Your Vercel account details</strong> are used only to publish your finished site, directly from
            your computer to Vercel.
          </li>
          <li>
            <strong>If you&apos;d rather nothing leave your computer at all</strong>, you can use Ollama instead of a
            cloud AI provider — it runs the AI model locally too, with no account and no key. It&apos;s slower and
            needs a capable computer, but it&apos;s the strongest privacy option available here.
          </li>
        </ul>
        <p className="meta">
          One honest caveat: that local settings file is plain, unencrypted text — normal for tools like this, but
          treat it the way you&apos;d treat any file with a password in it. Don&apos;t email your whole project
          folder to someone or upload it somewhere public without checking what&apos;s inside first.
        </p>
      </div>

      <div className="card">
        <h2>What you&apos;ll need before you start</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/help/what-youll-need.svg"
          alt="What you'll need: Node.js, an AI provider key (or Ollama), and a free Vercel account"
          style={{ maxWidth: "100%", height: "auto", marginBottom: 12 }}
        />
        <ul>
          <li>A computer running Windows, Mac, or Linux.</li>
          <li>
            <strong>Node.js installed.</strong> One small, standard, free developer tool — not specific to this
            project. (You don&apos;t need Git: this project is downloaded as a plain folder, and publishing your
            finished site talks to Vercel directly, never through GitHub.)
          </li>
          <li>
            <strong>An account and API key with an AI provider</strong> — Anthropic (Claude), Google (Gemini), or
            OpenRouter. Each has a free or pay-as-you-go tier; you sign up and generate a key yourself, directly on
            their site. (Or skip this entirely and use Ollama — see above.)
          </li>
          <li>
            <strong>A free Vercel account</strong>, for publishing your finished site live.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Getting started, step by step</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/help/getting-started-steps.svg"
          alt="Getting started: install tools, download the project, run it, upload your résumé, generate your site, then publish"
          style={{ maxWidth: "100%", height: "auto", marginBottom: 12 }}
        />
        <ol>
          <li>
            <strong>Install Node.js</strong> — run the installer with the default options, same as installing any
            other program. Get it here:{" "}
            <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer">
              nodejs.org
            </a>{" "}
            (choose the "LTS" version).
          </li>
          <li>
            <strong>Download this project as a ZIP and unzip it.</strong>
          </li>
          <li>
            <strong>Double-click the launcher for your system</strong> — it installs everything the first time
            (usually a minute or two), starts the tool, and opens your browser to it automatically every time after
            that. No terminal, no typing commands.
            <br />
            <span className="meta">
              <strong>Windows:</strong> double-click <code>Start SharperProfile.bat</code>.{" "}
              <strong>Mac:</strong> double-click <code>Start SharperProfile.command</code> — the first time, macOS
              will likely block it as being from an "unidentified developer" since it isn&apos;t code-signed;
              right-click (or Control-click) it and choose "Open" once to get past that, then it works normally.{" "}
              <strong>Linux:</strong> there&apos;s no universal double-click-to-run convention for a downloaded
              script, so open a terminal in the unzipped folder and run{" "}
              <code>chmod +x start.sh &amp;&amp; ./start.sh</code>. All three are in the same folder as{" "}
              <code>package.json</code>, right where you unzipped it. Prefer doing it yourself? The launchers are
              just running <code>npm install</code> then <code>npm run dev</code> — you can still type those two
              commands into a terminal instead, exactly as before.
            </span>
          </li>
          <li>
            <strong>Upload your résumé</strong> (Word document or PDF) in the browser tab that opens automatically.
          </li>
          <li>
            <strong>Review the sections</strong> the tool builds from your résumé, choose which to include, and
            enter your AI provider&apos;s API key when asked (or choose Ollama if you set that up instead).
          </li>
          <li>
            <strong>Generate your site, look it over, then connect your Vercel account and publish.</strong> This is
            Step 4 of the wizard — one click publishes your site to a live, shareable link, and a later click
            republishes to that same link whenever you make changes.
          </li>
        </ol>
      </div>

      <div className="card">
        <h2>Updating your site later</h2>
        <p>
          Because everything lives on your own computer, your project folder is also your archive. To make a
          change, come back to the same folder and double-click the launcher again (<code>Start SharperProfile.bat</code>
          / <code>.command</code>, or <code>./start.sh</code> on Linux) — or use <strong>Save / Export</strong> from
          any wizard step to save your progress as a file you can re-import later, including from a different
          computer.
        </p>
      </div>

      <p className="nextStepNote">
        <Link href="/wizard/step-1-upload">Back to the wizard</Link>
      </p>
    </main>
  );
}
