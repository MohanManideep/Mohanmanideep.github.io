# Mohan Manideep Danda — Personal Portfolio

This is the personal portfolio website of **Mohan Manideep Danda**.

**Live Website:**
https://mohanmanideep.github.io

The website showcases my profile, projects, work experience, education, technical skills, research interests, and contact links in a clean, responsive portfolio format.

---

## About This Project

This is not just a static portfolio website.

It is a **data-driven portfolio system** built using **React, Vite, Google Sheets, Google Apps Script, GitHub Actions, and GitHub Pages**.

The main idea is simple:

> I manage my portfolio content from a Google Spreadsheet, and the website updates automatically when I click an update button.

Instead of editing code every time I want to add a project, update my skills, or change my profile information, I update a Google Sheet. A custom button inside the sheet triggers GitHub Actions, fetches the latest data, rebuilds the website, and deploys it to GitHub Pages.

---

## Why I Built It This Way

The goal was to build a portfolio that is:

- easy to update
- free to host
- data-driven
- automated
- recruiter-friendly
- technically meaningful

This setup works like a lightweight personal CMS. Google Sheets acts as the content management system, while GitHub Actions handles the CI/CD pipeline.

---

## Main Features

- Personal portfolio hosted on GitHub Pages
- Google Sheets used as a lightweight CMS
- One-click website update from Google Sheets
- Automated deployment through GitHub Actions
- Data converted into `portfolio.json` during build
- Responsive design for desktop and mobile
- Smooth UI animations using Framer Motion
- Sections for profile, projects, experience, education, skills, interests, and contact

---

## Content Update Flow

To update the live website:

```text
1. Edit content in the Google Spreadsheet
2. Click the Update Website button
3. GitHub Actions starts automatically
4. The latest spreadsheet data is fetched
5. The website is rebuilt and deployed
6. The live portfolio updates
```

---

## The Pipeline Contract (read before changing anything)

The automatic "update from Google Sheets" flow depends on exactly six things. As long as
these are left alone, the update button keeps working. Everything else in this repository
can be changed freely.

| # | Must not change | Where |
|---|---|---|
| 1 | The dispatch event name `spreadsheet_update` | `.github/workflows/deploy.yml` — must match what the Apps Script sends |
| 2 | The spreadsheet ID and the nine tab names | `scripts/fetch-sheet-data.js` (`SPREADSHEET_ID`, `SHEETS`) |
| 3 | The sheet stays readable by anyone with the link | the CSV endpoint sends no credentials — a private sheet fails the build |
| 4 | The column headers the app reads | `src/App.jsx` (`normalizePortfolio`) — including `tittle`, `subtittle`, `education id` |
| 5 | The output path `src/data/portfolio.json` | written by the fetch script, imported by `src/App.jsx` |
| 6 | The workflow step order | fetch must run **before** build |

### Known quirks, kept on purpose

- The Projects tab headers are spelled `tittle` / `subtittle`, and the Education tab uses
  `education id` with a space. The code accepts both these and the correct spellings, so
  renaming the columns is unnecessary and risky — a rename must land in the sheet and the
  code at the same time or the section disappears from the live site.
- The `Media` and `Site_config` tabs are fetched but not currently rendered.

### Safe way to test a change to the pipeline

1. Push the change, then run the workflow from the **Actions** tab (Run workflow) rather
   than from the sheet — this isolates a code change from the Apps Script.
2. Check the "Fetch Google Sheet data" step logged all nine tabs.
3. Only then press the update button in the sheet to confirm the dispatch path.
4. If anything looks wrong, `git revert` and push. GitHub Pages keeps serving the last
   successful deploy, so a failed build never takes the live site down.

### Local development

```bash
npm ci
npm run dev      # uses the committed portfolio.json snapshot
npm run build
npm run lint
```

`src/data/portfolio.json` is committed as a snapshot so the site can be developed offline.
It is overwritten from the live sheet on every deploy.

---

## Author

**Mohan Manideep Danda**

- Portfolio: https://mohanmanideep.github.io
- GitHub: https://github.com/Mohanmanideep
- LinkedIn: https://www.linkedin.com/in/mohan-manideep-danda/

## Technical Paper

This project includes a technical paper describing the design, implementation, and evaluation of the spreadsheet-driven static portfolio deployment pipeline.

- [Read the Paper](docs/website_paper.pdf)
- [LaTeX Source](docs/main.tex)

The paper covers the Google Sheets CMS structure, GitHub Actions deployment workflow, React/Vite frontend, GitHub Pages hosting, and evaluation results using deployment timings, Lighthouse scores, and runtime observations.

**DOI:** [10.5281/zenodo.21041486](https://doi.org/10.5281/zenodo.21041486)

**Citation:**

Mohan Manideep Danda. *Design and Evaluation of a Spreadsheet-Driven Static Portfolio Deployment Pipeline Using Google Sheets and GitHub Actions*. Zenodo, 2026. https://doi.org/10.5281/zenodo.21041486
