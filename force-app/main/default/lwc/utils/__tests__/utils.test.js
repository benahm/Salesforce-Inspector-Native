import { readFileSync } from "fs";
import { join } from "path";
import { VERSION, mergeSelection, parseLogins } from "c/utils";

describe("VERSION", () => {
  it("matches the version number of sfdx-project.json", () => {
    // npm run package:version copies it: run it, or update VERSION by hand.
    const project = JSON.parse(
      readFileSync(join(process.cwd(), "sfdx-project.json"), "utf8")
    );
    const versionNumber = project.packageDirectories.find(
      (dir) => dir.default
    ).versionNumber;
    expect(VERSION).toBe(versionNumber.split(".").slice(0, 3).join("."));
  });
});

describe("mergeSelection", () => {
  it("keeps the hidden selected rows and replaces the shown ones", () => {
    expect(mergeSelection(["a", "b", "c"], ["b", "c", "d"], ["d"])).toEqual([
      "a",
      "d"
    ]);
  });

  it("adds a new selection to an empty one", () => {
    expect(mergeSelection([], ["a", "b"], ["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("parseLogins", () => {
  it("splits on new lines, commas, semicolons and spaces", () => {
    expect(
      parseLogins(
        "Alice@Example.com\r\nbob@example.com, chloe@example.com;\tdan"
      )
    ).toEqual([
      "alice@example.com",
      "bob@example.com",
      "chloe@example.com",
      "dan"
    ]);
  });

  it("drops blanks and duplicates", () => {
    expect(parseLogins(" a@x.com \n\nA@X.com,,")).toEqual(["a@x.com"]);
    expect(parseLogins(undefined)).toEqual([]);
  });
});
