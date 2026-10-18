import {
  applySuggestion,
  flattenRecord,
  getCursorContext,
  getFromObject,
  getSelectedFields,
  toCsv,
  toTable,
  toTsv
} from "c/sfiQueryUtils";

describe("getFromObject", () => {
  it("returns the main object and ignores subqueries", () => {
    expect(
      getFromObject(
        "SELECT Id, (SELECT Id FROM Contacts) FROM Account WHERE Name = 'x'"
      )
    ).toBe("Account");
  });

  it("returns null without FROM", () => {
    expect(getFromObject("SELECT Id")).toBeNull();
  });
});

describe("getCursorContext", () => {
  it("detects the FROM clause", () => {
    const soql = "SELECT Id FROM Acc";
    expect(getCursorContext(soql, soql.length)).toMatchObject({
      clause: "FROM",
      token: "Acc",
      prefix: "Acc",
      path: []
    });
  });

  it("detects a relationship path in SELECT", () => {
    const soql = "SELECT Id, Owner.Na";
    expect(getCursorContext(soql, soql.length)).toMatchObject({
      clause: "SELECT",
      path: ["Owner"],
      prefix: "Na"
    });
  });

  it("detects WHERE and ORDER BY", () => {
    const where = "SELECT Id FROM Account WHERE Na";
    expect(getCursorContext(where, where.length).clause).toBe("WHERE");
    const orderBy = "SELECT Id FROM Account ORDER BY Cr";
    expect(getCursorContext(orderBy, orderBy.length).clause).toBe("ORDER BY");
  });

  it("does not treat the keyword being typed as the clause", () => {
    const soql = "SELECT Id FROM";
    expect(getCursorContext(soql, soql.length).clause).toBe("SELECT");
  });
});

describe("applySuggestion", () => {
  it("replaces the token at the cursor", () => {
    const soql = "SELECT Na FROM Account";
    expect(applySuggestion(soql, 9, "Na", "Name")).toEqual({
      text: "SELECT Name FROM Account",
      cursor: 11
    });
  });
});

describe("getSelectedFields", () => {
  it("lists top-level fields and aliases", () => {
    expect(
      getSelectedFields(
        "SELECT Id, Account.Name, COUNT(Id) total, (SELECT Id FROM Cases) FROM Contact"
      )
    ).toEqual(["id", "account.name", "total", "(select id from cases)"]);
  });
});

describe("flattenRecord and toTable", () => {
  const records = [
    {
      attributes: { type: "Contact" },
      Account: { attributes: { type: "Account" }, Name: "Acme", Id: "001" },
      LastName: "Doe",
      Id: "003",
      Cases: { totalSize: 2, done: true, records: [{}, {}] }
    }
  ];

  it("flattens relationships and subqueries", () => {
    expect(flattenRecord(records[0])).toEqual({
      "Account.Name": "Acme",
      "Account.Id": "001",
      LastName: "Doe",
      Id: "003",
      Cases: "[2 records]"
    });
  });

  it("orders columns like the SELECT list", () => {
    const { columns } = toTable(
      records,
      "SELECT Id, LastName, Account.Name FROM Contact"
    );
    expect(columns.slice(0, 3)).toEqual(["Id", "LastName", "Account.Name"]);
  });

  it("hides fields Apex fetched implicitly and keeps subqueries", () => {
    const { columns } = toTable(
      records,
      "SELECT Id, LastName, Account.Name, (SELECT Id FROM Cases) FROM Contact"
    );
    expect(columns).toEqual(["Id", "LastName", "Account.Name", "Cases"]);
  });

  it("keeps every column for FIELDS() queries", () => {
    const { columns } = toTable(
      records,
      "SELECT FIELDS(STANDARD) FROM Contact"
    );
    expect(columns).toHaveLength(5);
  });
});

describe("exports", () => {
  const columns = ["Id", "Name"];
  const rows = [{ Id: "001", Name: 'Acme, "Inc"\nFR' }];

  it("escapes CSV values", () => {
    expect(toCsv(columns, rows)).toBe('Id,Name\r\n001,"Acme, ""Inc""\nFR"');
  });

  it("flattens TSV values", () => {
    expect(toTsv(columns, rows)).toBe('Id\tName\r\n001\tAcme, "Inc" FR');
  });
});
