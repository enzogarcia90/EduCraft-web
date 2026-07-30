# EduCraft Web

Public website, static client build and dashboard shell for EduCraft, a Spanish EdTech startup created in 2026 to bring managed Minecraft classrooms to schools.

## Public Contents

- Public company website.
- Static EduCraft client build.
- Private dashboard shell with JWT login for company administration, TIC and teacher controls.
- Product pages for platform, plans, data and contact.

## Why This Repository Exists

EduCraft uses two linked GitHub repositories on purpose:

- `EduCraft`: private development repository with backend, source code, plugins, internal docs and infrastructure work.
- `EduCraft-web`: public/static repository for GitHub Pages with only website files, static client builds, public assets and the dashboard shell.

This separation keeps the public website easy to deploy while avoiding accidental exposure of private development files. In short: developers are humans, humans make mistakes, and this repo layout makes the dangerous mistake harder to make.

## Deployment

This repository is designed to be published as a static site with GitHub Pages.

Suggested public routes:

- `/` public website.
- `/cliente/` EduCraft client.
- `/dashboard/` private dashboard shell for administration, TIC and teachers.

Dynamic data, authentication, telemetry and Minecraft servers run outside GitHub Pages on private infrastructure. The dashboard calls the Go API configured by `cliente/educraft-config.js`.

## What Deploys Where

- `EduCraft-web`: public static website, `/cliente/` static client files and `/dashboard/` public shell. Deploys to GitHub Pages.
- `EduCraft`: private source repository for backend, client source, plugins, docs and internal infrastructure. Do not publish this repository as the public website.
- Go backend API: deploys to the Windows server under `C:\EduCraftBackend`, runs as scheduled task `EduCraftAPI`, listens internally on `127.0.0.1:18080`.
- Public API domain: `https://educraftes.duckdns.org`, served by the separated IIS site `EduCraft API` with Let's Encrypt certificate from win-acme.
- Client API config: `cliente/educraft-config.js` must point to `https://educraftes.duckdns.org`.
- Discord bot/setup: runs separately with its own `.env`; do not put Discord tokens in this repository.
- Paper and Velocity servers are separate and are not deployed as part of this static web repo.

Do not deploy EduCraft backend code, private `.env` files, server binaries or ICServices files to this repository.

## GitHub Pages Setup

In the GitHub repository settings, set Pages to deploy from GitHub Actions. After that, every push to `main` publishes the static site automatically.
