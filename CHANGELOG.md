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
