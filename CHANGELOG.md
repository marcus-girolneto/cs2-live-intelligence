# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/) and
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-19

### Added

- FRAGMIND brand, logo and conversion-focused landing; Steam-only accounts with rich Steam profile.
- Demo parser enrichment: shots, hit groups, weapons, callouts, kill positions, round timing,
  grenades, flashes, bomb events, economy and 8 Hz replay samples.
- Analysis: aim (hit-group body map, accuracy, weapons), map plot and callouts, timing, utility,
  economy, rounds with kill feed.
- AI coach (provider-agnostic, admin-configured): IGL-style reviews with deterministic scores,
  key moments with 2D replay clips (WebM export), drills, map-scoped vs general plans, learning
  from the player's history; live AI IGL calls between rounds on the second screen.
- Roles and admin area: AI providers (encrypted keys), model assignment per purpose, app settings,
  users and roles, plans, audit log, analysis reprocessing.
- Plans (Free / Basic / Pro) with daily quotas and Stripe checkout (optional).
- Layered architecture: API modules (routes/controller/service/repository/DTO) and web feature
  modules (api/hooks/components/model).

### Fixed

- Recent CS2 demos failed with "Demo parser rejected input": the parser now uses demoinfocs-golang v5.2.0 (`cs2live.4`), and the API logs the parser's own error message.

### Planned

- Real 3D clips rendered from the demo in the CS2 client (self-hosted GPU render worker or a render API); v1 ships 2D replay clips.
- Automatic demo import: Valve share-code sync (game authentication code + match sharing code) with Game Coordinator download via a secondary Steam account, and FACEIT Downloads API (requires FACEIT approval). v1 uses manual uploads up to 500 MB.
