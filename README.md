# Turn your resume into a live portfolio website

*A tool that reads your resume and helps you build a real, working personal website — using AI you connect yourself, running entirely on your own computer.*

## What this is, in plain English

You give this tool your resume. It reads through it, pulls out your experience, skills, and story, and — using an AI model you choose and connect yourself — turns that into the content for a clean, professional portfolio website. When you're ready, you publish that website live with your own Vercel account, so you have a real link you can share with employers, clients, or anyone else.

This tool runs on **your own computer**. It isn't a website you log into — it's a small program you download and run yourself, the same general idea as installing any other desktop tool. That's a deliberate choice, and it's the reason the next section can make the promises it makes.

![How it works: your resume goes into the tool running on your computer, which builds your portfolio website](docs/help/how-it-works.svg)

## Is this safe? Do my information and API keys leave my computer?

Short answer: your resume, your AI provider key, and your Vercel details never go to us, and never touch any server we operate. Here's exactly where things go instead — and because this project is open source, you (or anyone technical you trust) can read the actual code and check this yourself, rather than just taking our word for it.

![Where your keys actually go: from your computer directly to your chosen AI provider and to Vercel, never to Pranay's servers](docs/help/where-keys-go.svg)

- **Your resume** is read locally by the tool on your machine, then sent only to the AI provider you chose — the same as if you'd pasted it into that provider's own website yourself.
- **Your AI provider key** is used only to talk to that provider, directly from your computer. It's saved in a local settings file (`.env.local`) so you don't have to re-type it every time. That file is already excluded from anything that gets uploaded to GitHub — confirmed in this project's own `.gitignore` — so it won't get shared by accident even if you push your own copy of this project online.
- **Your Vercel account details** are used only to publish your finished site, directly from your computer to Vercel.
- **If you'd rather nothing leave your computer at all**, you can use Ollama instead of a cloud AI provider — it runs the AI model locally too, with no account and no key. It's slower and needs a capable computer, but it's the strongest privacy option available here.

One honest caveat: that local settings file is plain, unencrypted text — normal for tools like this, but treat it the way you'd treat any file with a password in it. Don't email your whole project folder to someone or upload it somewhere public without checking what's inside first.

## What you'll need before you start

![What you'll need: Node.js, an AI provider key (or Ollama), and a free Vercel account](docs/help/what-youll-need.svg)

- **A computer** running Windows, Mac, or Linux.
- **Node.js installed.** One small, standard, free developer tool — not specific to this project. Step 1 below links to it. (You don't need Git: this project is downloaded as a plain ZIP, and publishing talks to Vercel directly — never through GitHub.)
- **An account and API key with an AI provider** — Anthropic (Claude), Google (Gemini), or OpenRouter. Each has a free or pay-as-you-go tier; you sign up and generate a key yourself, directly on their site. (Or skip this entirely and use Ollama — see above.)
- **A free Vercel account**, for publishing your finished site live.

## Getting started, step by step

![Getting started: install Node.js, download the project as a ZIP, double-click the launcher, review your resume, generate your site, then publish](docs/help/getting-started-steps.svg)

1. **Install Node.js.** Get it from [nodejs.org](https://nodejs.org) (choose the "LTS" version) — run the installer with the default options, same as installing any other program.
2. **Download this project as a ZIP and unzip it.**
3. **Double-click the launcher for your system.** It installs everything the first time (usually a minute or two), starts the tool, and opens your browser to it automatically every time after that — no terminal, no typing commands.
   - **Windows:** double-click `Start SharperProfile.bat`.
   - **Mac:** double-click `Start SharperProfile.command` — the first time, macOS will likely block it as being from an "unidentified developer" since it isn't code-signed; right-click (or Control-click) it and choose "Open" once to get past that, then it works normally after.
   - **Linux:** there's no universal double-click-to-run convention for a downloaded script, so open a terminal in the unzipped folder and run `chmod +x start.sh && ./start.sh`.

   All three launchers are plain-text scripts (not compiled binaries) sitting right in the folder you unzipped, next to `package.json` — you can open any of them in a text editor to see exactly what they do. Prefer doing it yourself? They're just running `npm install` then `npm run dev` — you can still type those two commands into a terminal instead, exactly as before.
4. **Upload your resume** (Word document or PDF) in the browser tab that opens automatically.
5. **Review the sections the tool builds from your resume**, and enter your AI provider's API key when asked (or choose Ollama if you set that up instead).
6. **Generate your site, look it over, then connect your Vercel account and publish.** This is Step 4 of the wizard — one click publishes your site to a live, shareable link, and a later click republishes to that same link whenever you make changes.

## Updating your site later

Because everything lives on your own computer, your project folder is also your archive. To make a change, come back to the same folder and double-click the launcher again (`Start SharperProfile.bat` / `.command`, or `./start.sh` on Linux) — or use **Save / Export** from any wizard step to save your progress as a file you can re-import later, including from a different computer.
