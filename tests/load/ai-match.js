import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    active_players: { executor: "ramping-vus", stages: [{ duration: "30s", target: 20 }, { duration: "1m", target: 20 }, { duration: "15s", target: 0 }] }
  },
  thresholds: { http_req_failed: ["rate<0.01"], http_req_duration: ["p(95)<500"] }
};

const api = __ENV.API_URL || "http://127.0.0.1:4000/v1";
const headers = { "content-type": "application/json", "x-test-principal": `ACCOUNT:k6-${__VU}` };

export default function () {
  const created = http.post(`${api}/matches/ai`, JSON.stringify({ seed: Date.now() + __VU }), { headers });
  check(created, { "match created": (response) => response.status === 201 });
  if (created.status !== 201) return;
  const matchId = created.json("matchId");
  let snapshot = created.json("snapshot");
  for (let move = 0; move < 10 && snapshot.status === "ACTIVE"; move += 1) {
    const action = snapshot.legalActions[0];
    if (!action) break;
    const command = action.type === "PLAY_TILE"
      ? { type: action.type, tileId: action.tileId, side: action.sides[0] }
      : { type: action.type };
    const commandId = `00000000-0000-4000-8000-${String(__VU * 10000 + move).padStart(12, "0")}`;
    const response = http.post(`${api}/matches/${matchId}/commands`, JSON.stringify({ commandId, expectedVersion: snapshot.version, command }), { headers });
    check(response, { "command accepted": (value) => value.status === 201 });
    if (response.status !== 201) break;
    snapshot = response.json("snapshot");
    sleep(0.1);
  }
}
