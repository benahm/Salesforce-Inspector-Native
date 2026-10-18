import {
  autoMap,
  detectDelimiter,
  fieldsForOperation,
  parseCsv,
  resultsToCsv,
  toRecords,
  validateMapping
} from "c/sfiImportUtils";

const FIELDS = [
  {
    name: "Id",
    label: "Contact ID",
    createable: false,
    updateable: false,
    requiredOnCreate: false
  },
  {
    name: "LastName",
    label: "Last Name",
    createable: true,
    updateable: true,
    requiredOnCreate: true
  },
  {
    name: "Email",
    label: "Email",
    createable: true,
    updateable: true,
    requiredOnCreate: false
  },
  {
    name: "Ext__c",
    label: "External",
    createable: true,
    updateable: true,
    requiredOnCreate: false
  },
  {
    name: "CreatedDate",
    label: "Created Date",
    createable: false,
    updateable: false,
    requiredOnCreate: false
  }
];

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, line breaks and CRLF", () => {
    const csv = 'Id,Name\r\n001,"Acme, ""Inc"""\r\n002,"Multi\nline"\r\n';
    expect(parseCsv(csv)).toEqual({
      header: ["Id", "Name"],
      rows: [
        ["001", 'Acme, "Inc"'],
        ["002", "Multi\nline"]
      ],
      delimiter: ","
    });
  });

  it("detects semicolons and tabs (Excel paste)", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(parseCsv("LastName\tEmail\nDoe\td@x.com").rows).toEqual([
      ["Doe", "d@x.com"]
    ]);
  });

  it("strips the BOM and skips empty lines", () => {
    const { header, rows } = parseCsv("\uFEFFLastName\n\nDoe\n\n");
    expect(header).toEqual(["LastName"]);
    expect(rows).toEqual([["Doe"]]);
  });
});

describe("autoMap", () => {
  it("maps by API name then label and never twice", () => {
    expect(
      autoMap(["id", "Last Name", "EMAIL", "Unknown", "LastName"], FIELDS)
    ).toEqual(["Id", "LastName", "Email", "", ""]);
  });
});

describe("fieldsForOperation", () => {
  it("filters fields by operation", () => {
    expect(fieldsForOperation(FIELDS, "insert").map((f) => f.name)).toEqual([
      "LastName",
      "Email",
      "Ext__c"
    ]);
    expect(fieldsForOperation(FIELDS, "update").map((f) => f.name)).toEqual([
      "Id",
      "LastName",
      "Email",
      "Ext__c"
    ]);
    expect(fieldsForOperation(FIELDS, "delete").map((f) => f.name)).toEqual([
      "Id"
    ]);
  });
});

describe("validateMapping", () => {
  it("requires Id for update and delete", () => {
    const { errors } = validateMapping({
      operation: "update",
      mapping: ["LastName"],
      fields: FIELDS,
      rowCount: 1
    });
    expect(errors).toContain("An Id column is required for update.");
  });

  it("requires the external Id field for upsert", () => {
    const { errors } = validateMapping({
      operation: "upsert",
      mapping: ["LastName"],
      fields: FIELDS,
      externalIdField: "Ext__c",
      rowCount: 1
    });
    expect(errors).toContain("Map a column to the external Id field Ext__c.");
  });

  it("warns about missing required fields on insert", () => {
    const { errors, warnings } = validateMapping({
      operation: "insert",
      mapping: ["Email", ""],
      fields: FIELDS,
      rowCount: 2
    });
    expect(errors).toEqual([]);
    expect(warnings[0]).toContain("LastName");
    expect(warnings[1]).toBe("1 column(s) will be ignored.");
  });
});

describe("toRecords and resultsToCsv", () => {
  const header = ["LastName", "Notes"];
  const rows = [
    ["Doe", "x"],
    ["Roe", "y"],
    ["Poe", "z"]
  ];

  it("keeps mapped columns only", () => {
    expect(toRecords(rows.slice(0, 1), ["LastName", ""])).toEqual([
      { LastName: "Doe" }
    ]);
  });

  it("appends the outcome of each row", () => {
    const results = [
      { success: true, created: true, id: "003A" },
      { success: false, error: "REQUIRED_FIELD_MISSING" }
    ];
    expect(resultsToCsv(header, rows, results)).toBe(
      "LastName,Notes,SFI_Status,SFI_Id,SFI_Error\r\n" +
        "Doe,x,Created,003A,\r\n" +
        "Roe,y,Error,,REQUIRED_FIELD_MISSING\r\n" +
        "Poe,z,Not processed,,"
    );
    expect(
      resultsToCsv(header, rows, results, true).split("\r\n")
    ).toHaveLength(2);
  });
});
