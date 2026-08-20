# EduCraft Web

Public website, static client build and dashboard shell for EduCraft, a Spanish EdTech startup created in 2026 to bring managed Minecraft classrooms to schools.

## Public Contents

- Public company website.
- Static EduCraft client build.
- Private dashboard shell with JWT login for company administration, TIC and teacher controls.
- Product pages for platform, plans, data and contact.

## Why This Repository Exists

EduCraft separates private application code from this public static repository.

This separation keeps the public website easy to deploy while avoiding accidental exposure of private development files. In short: developers are humans, humans make mistakes, and this repo layout makes the dangerous mistake harder to make.

## Deployment

This repository is designed to be published as a static site with GitHub Pages.

Suggested public routes:

- `/` public website.
- `/cliente/` EduCraft client.
- `/dashboard/` private dashboard shell for administration, TIC and teachers.

Dynamic data and authenticated services run outside GitHub Pages. The browser uses the public service URL configured in `cliente/educraft-config.js`.

## Publication boundary

Only static website, client and dashboard assets belong here. Never publish private source code, environment files, credentials, tokens, certificates, server binaries, internal paths, network topology or operational configuration in this repository.

## GitHub Pages Setup

In the GitHub repository settings, set Pages to deploy from GitHub Actions. After that, every push to `main` publishes the static site automatically.
