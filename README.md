# EduCraft Web

Public website, static client build and dashboard shell for EduCraft, a Spanish EdTech startup created in 2026 to bring managed Minecraft classrooms to schools.

## Public Contents

- Public company website.
- Static EduCraft client build.
- Public dashboard shell for future teacher tools.
- Product pages for platform, plans, data and contact.

## Why This Repository Exists

EduCraft uses two linked GitHub repositories on purpose:

- `EduCraft`: private development repository with backend, source code, plugins, internal docs and infrastructure work.
- `EduCraft-web`: public/static repository for GitHub Pages with only website files, static client builds, public assets and the dashboard shell.

This separation keeps the public website easy to deploy while avoiding accidental exposure of private development files. In short: developers are humans, humans make mistakes, and this repo layout makes the dangerous mistake harder to make.

## Deployment

This folder is designed to be published as a static site with GitHub Pages.

Suggested public routes:

- `/` public website.
- `/cliente/` EduCraft client.
- `/dashboard/` dashboard shell.

Dynamic data, authentication, telemetry and Minecraft servers must run outside GitHub Pages on private infrastructure.
