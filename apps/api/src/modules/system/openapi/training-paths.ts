import { trainingPlanSchema } from "@cs2/contracts";
import { id, json, operation, schema, success } from "./helpers.js";

const steamId = [
  ...id,
  { name: "steamId", in: "query", required: true, schema: { type: "string" } },
];

/** Practice catalog and deterministic training plans (no AI, no credits). */
export const trainingPaths = {
  "/v1/training/catalog": {
    get: operation(
      "Verified CS2 practice catalog {verifiedAt, skills[], entries[{id, skill: aim|crosshair|utility|spray|movement|positioning, title, kind: workshop|official, workshopId?, maps?, url, minutesPerSession, howTo[], tags[], links:{steam?: steam://url/CommunityFilePage/<id>, web?: https://steamcommunity.com/sharedfiles/filedetails/?id=<id>, launch: steam://rungameid/730, command?: host_workshop_map <id>}, verified?:{at, subscriptions}}]}. Workshop ids are checked with Steam's GetPublishedFileDetails (pnpm training:verify)",
    ),
  },
  "/v1/training/recommended": {
    get: operation(
      "Recommended practice from the tracked player's latest own matches {steamId|null, latest:{analysisId, createdAt, map, training}|null, focus[], week[{day, rest, focus?, steps[{step, minutes, skill?, resourceId?}]}], matches}",
    ),
  },
  "/v1/analyses/{id}/training": {
    get: operation(
      "Owner only: the match's practice plan for a player {analysisId, steamId, training}. Sessions follow review, warmup, habit, focus, debrief; teleports are setpos_exact/setang lines from the demo (pitch positive = down, yaw 0 = +X). Also added as `training` to GET /v1/analyses/{id}/reviews, POST /v1/analyses/{id}/coaching and the team review responses",
      {
        parameters: steamId,
        responses: {
          ...success,
          200: {
            description: "Training plan",
            content: json({
              type: "object",
              properties: { training: schema(trainingPlanSchema) },
            }),
          },
        },
      },
    ),
  },
};
