export const privacyNotice = [
  {
    title: "Who operates this installation",
    text: "This is a local demonstration operated by the person running it. Operator contact details are not configured. Ask the installation operator before sharing information with other people or using a hosted deployment.",
  },
  {
    title: "What is stored locally",
    text: "PostgreSQL stores your Steam identifier or explicitly provisioned local account identifier, consent choices, hashed application and device credentials, device names, live session snapshots, demo job metadata, analysis, coaching and submitted feedback. Uploaded .dem files are stored in the local filesystem volume. Uploaded demos may contain names, identifiers and match events for other visible players; upload only demos you are entitled to use. Live GSI statistics are limited to your own player where the game identifies that player.",
  },
  {
    title: "Steam sign-in",
    text: "Steam OpenID establishes a Steam identifier. It does not grant access to private profile information, private match history or other Steam account data. Steam handles the sign-in itself; this application does not collect your Steam password. Real account sign-in must be validated separately for this installation.",
  },
  {
    title: "Consent and feedback",
    text: "Telemetry consent controls new live telemetry and demo processing. Product analytics consent is a separate choice. Product events require analytics consent; feedback is collected only when you deliberately submit a rating or comment, and is also subject to the service’s consent checks. Manage these choices in Settings & privacy. Withdrawing consent does not automatically delete previously retained records; use account deletion to remove them.",
  },
  {
    title: "AI coaching processing",
    text: "Without an AI processing service configured by the operator, coaching is generated offline and no provider request is made. When the operator configures one, the service may send bounded numeric metric evidence, opaque evidence identifiers and caveats to that AI processing service for coaching. Player names, raw demos and raw telemetry are not included in those requests. Provider requests disable API response storage. Provider processing is subject to the provider’s terms; this notice does not promise zero provider retention.",
  },
  {
    title: "Retention and deletion",
    text: "Your retention setting is between 1 and 90 days. Retention cleanup runs on service startup and hourly, so records and files can remain until the next cleanup after their retention period expires. Account deletion immediately removes the account and associated database records and invalidates access. Uploaded files are placed in a durable deletion queue and removed by the cleanup worker. Cleanup requires the service to be running; failed removals remain queued for retry. Backups copied by the local operator must be managed by that operator.",
  },
  {
    title: "Scope of this notice",
    text: "This notice describes the local demonstration. It does not certify legal compliance or replace the operator’s responsibilities when handling other people’s data. A public deployment needs its own operator details, contact information, provider disclosures and applicable privacy review.",
  },
] as const;
