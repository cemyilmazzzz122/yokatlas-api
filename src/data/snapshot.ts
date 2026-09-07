import type { City, ProgramGroup, University } from "../types";
import rawSnapshot from "./lookupSnapshot.json";

export interface LookupSnapshotData {
  fetchedAt: number;
  universities: University[];
  programGroups: ProgramGroup[];
  cities: City[];
}

export const LOOKUP_SNAPSHOT: LookupSnapshotData = rawSnapshot as unknown as LookupSnapshotData;
