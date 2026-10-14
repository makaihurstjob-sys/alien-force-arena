import { beforeEach, describe, expect, it, vi } from "vitest";
import { duelHistory, saveDeviceHistory, readDeviceHistory, sortHistory, serverHistory, type HistoryRecord } from "./match-history";
import { createMatch } from "../game/engine";
const memory = new Map<string,string>();
const storage = { getItem: (key:string) => memory.get(key) ?? null, setItem: (key:string,value:string) => {memory.set(key,value);} };
beforeEach(() => { memory.clear(); vi.stubGlobal("localStorage",storage); vi.stubGlobal("window",{dispatchEvent:vi.fn()}); });
describe("Unified match history", () => {
  it("uses personal team scores and the correct outcome without mutating gameplay", () => {
    const state = createMatch([{id:"a",name:"Alice",team:0},{id:"b",name:"Bob",team:1}]); state.tick=600;state.score=[4,1];state.matchWinner=0;
    const saved = duelHistory(state,"arcade","b","match")!;
    expect(saved).toMatchObject({outcome:"loss",score:1,opponentScore:4,durationMs:10000,opponent:"Alice"});
    state.score[1]=99;expect(saved.score).toBe(1);
  });
  it("isolates accounts, deduplicates repeated saves, and protects results from teardown", () => {
    const saved = {id:"match",mode:"versus" as const,outcome:"win" as const,durationMs:1200,score:4,opponentScore:2};
    saveDeviceHistory(saved,"alice");saveDeviceHistory(saved,"alice");saveDeviceHistory({...saved,outcome:"left"},"alice");saveDeviceHistory(saved,"bob");
    expect(readDeviceHistory("alice")).toHaveLength(1);expect(readDeviceHistory("alice")[0]?.outcome).toBe("win");expect(readDeviceHistory(null)).toHaveLength(0);
    expect(readDeviceHistory("bob")).toHaveLength(1);
  });
  it("places newer modes first and favors trusted account records over local duplicates", () => {
    const base = {id:"versus:same",owner:"alice",mode:"versus",outcome:"win",durationMs:100,source:"device",recordedAt:"2026-10-01T00:00:00Z"} as HistoryRecord;
    const merged=sortHistory([base,{...base,id:"same",source:"account"},{...base,id:"new",mode:"practice",recordedAt:"2026-10-02T00:00:00Z"}]);
    expect(merged).toHaveLength(2);expect(merged[0]?.mode).toBe("practice");expect(merged[1]?.source).toBe("account");
  });
  it("uses settled ranked ratings and records disconnects without inventing scores", () => {
    const result=serverHistory({id:"ranked-id",mode:"1v1",status:"completed",started_at:"2026-10-01T00:00:00Z",ended_at:"2026-10-01T00:01:00Z",match_participants:[{player_id:"alice",team:1,outcome:"disconnect",rating_before:131,rating_after:101,shots:0,hits:0}]},"alice");
    expect(result).toMatchObject({mode:"ranked",outcome:"disconnect",ratingBefore:131,ratingAfter:101,durationMs:60000});expect(result?.score).toBeUndefined();
  });
});
