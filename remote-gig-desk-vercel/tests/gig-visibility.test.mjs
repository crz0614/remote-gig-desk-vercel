import assert from "node:assert/strict";
import test from "node:test";
import { filterAvailableGigs } from "../lib/gig-visibility.ts";

test("applied gigs disappear from the opportunity list", () => {
  const gigs = [{ id: "new" }, { id: "applied" }, { id: "another" }];
  assert.deepEqual(
    filterAvailableGigs(gigs, ["applied"]).map((gig) => gig.id),
    ["new", "another"],
  );
});

test("server application records keep gigs hidden after reload", () => {
  const gigs = [{ id: "submitted" }, { id: "queued" }, { id: "open" }];
  const records = [{ gigId: "submitted" }, { gigId: "queued" }];
  assert.deepEqual(filterAvailableGigs(gigs, records.map((record) => record.gigId)), [{ id: "open" }]);
});
