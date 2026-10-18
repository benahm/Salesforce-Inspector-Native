/**
 * Shared helpers for SF Inspector Native components.
 */

export const VERSION = "0.1.0";

const ID_PATTERN = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

export function isSalesforceId(value) {
  return ID_PATTERN.test((value || "").trim());
}

export function showAllDataUrl(recordId) {
  return `/lightning/cmp/c__sfiShowAllData?c__recordId=${encodeURIComponent(recordId)}`;
}

export function recordUrl(recordId) {
  return `/lightning/r/${encodeURIComponent(recordId)}/view`;
}

export function objectSetupUrl(objectApiName, page = "Details") {
  return `/lightning/setup/ObjectManager/${encodeURIComponent(objectApiName)}/${page}/view`;
}

export const OBJECT_SETUP_PAGES = [
  { label: "Details", page: "Details" },
  { label: "Fields & Relationships", page: "FieldsAndRelationships" },
  { label: "Page Layouts", page: "PageLayouts" },
  { label: "Lightning Pages", page: "LightningPages" },
  { label: "Record Types", page: "RecordTypes" },
  { label: "Validation Rules", page: "ValidationRules" },
  { label: "Triggers", page: "ApexTriggers" },
  { label: "Buttons, Links & Actions", page: "ButtonsLinksActions" }
];

export const SETUP_SHORTCUTS = [
  {
    label: "Users",
    section: "Users",
    url: "/lightning/setup/ManageUsers/home"
  },
  {
    label: "Profiles",
    section: "Users",
    url: "/lightning/setup/EnhancedProfiles/home"
  },
  {
    label: "Permission Sets",
    section: "Users",
    url: "/lightning/setup/PermSets/home"
  },
  {
    label: "Permission Set Groups",
    section: "Users",
    url: "/lightning/setup/PermSetGroups/home"
  },
  { label: "Roles", section: "Users", url: "/lightning/setup/Roles/home" },
  {
    label: "Public Groups",
    section: "Users",
    url: "/lightning/setup/PublicGroups/home"
  },
  { label: "Queues", section: "Users", url: "/lightning/setup/Queues/home" },
  {
    label: "Login History",
    section: "Users",
    url: "/lightning/setup/OrgLoginHistory/home"
  },
  {
    label: "Object Manager",
    section: "Objects",
    url: "/lightning/setup/ObjectManager/home"
  },
  {
    label: "Schema Builder",
    section: "Objects",
    url: "/lightning/setup/SchemaBuilder/home"
  },
  {
    label: "Custom Metadata Types",
    section: "Objects",
    url: "/lightning/setup/CustomMetadata/home"
  },
  {
    label: "Custom Settings",
    section: "Objects",
    url: "/lightning/setup/CustomSettings/home"
  },
  {
    label: "Picklist Value Sets",
    section: "Objects",
    url: "/lightning/setup/Picklists/home"
  },
  {
    label: "Sharing Settings",
    section: "Security",
    url: "/lightning/setup/SecuritySharing/home"
  },
  {
    label: "Named Credentials",
    section: "Security",
    url: "/lightning/setup/NamedCredential/home"
  },
  {
    label: "Remote Site Settings",
    section: "Security",
    url: "/lightning/setup/SecurityRemoteProxy/home"
  },
  {
    label: "Session Settings",
    section: "Security",
    url: "/lightning/setup/SecuritySession/home"
  },
  { label: "Flows", section: "Automation", url: "/lightning/setup/Flows/home" },
  {
    label: "Process Automation Settings",
    section: "Automation",
    url: "/lightning/setup/WorkflowSettings/home"
  },
  {
    label: "Apex Classes",
    section: "Code",
    url: "/lightning/setup/ApexClasses/home"
  },
  {
    label: "Apex Triggers",
    section: "Code",
    url: "/lightning/setup/ApexTriggers/home"
  },
  {
    label: "Apex Jobs",
    section: "Code",
    url: "/lightning/setup/AsyncApexJobs/home"
  },
  {
    label: "Scheduled Jobs",
    section: "Code",
    url: "/lightning/setup/ScheduledJobs/home"
  },
  {
    label: "Debug Logs",
    section: "Code",
    url: "/lightning/setup/ApexDebugLogs/home"
  },
  {
    label: "Lightning Components",
    section: "Code",
    url: "/lightning/setup/LightningComponentBundles/home"
  },
  {
    label: "Visualforce Pages",
    section: "Code",
    url: "/lightning/setup/ApexPages/home"
  },
  {
    label: "Static Resources",
    section: "Code",
    url: "/lightning/setup/StaticResources/home"
  },
  {
    label: "Custom Labels",
    section: "Code",
    url: "/lightning/setup/ExternalStrings/home"
  },
  {
    label: "Deployment Status",
    section: "Deploy",
    url: "/lightning/setup/DeployStatus/home"
  },
  {
    label: "Inbound Change Sets",
    section: "Deploy",
    url: "/lightning/setup/InboundChangeSet/home"
  },
  {
    label: "Outbound Change Sets",
    section: "Deploy",
    url: "/lightning/setup/OutboundChangeSet/home"
  },
  {
    label: "Installed Packages",
    section: "Deploy",
    url: "/lightning/setup/ImportedPackage/home"
  },
  {
    label: "Email Deliverability",
    section: "Org",
    url: "/lightning/setup/OrgEmailSettings/home"
  },
  {
    label: "Company Information",
    section: "Org",
    url: "/lightning/setup/CompanyProfileInfo/home"
  },
  {
    label: "Setup Audit Trail",
    section: "Org",
    url: "/lightning/setup/SecurityEvents/home"
  },
  {
    label: "App Manager",
    section: "Org",
    url: "/lightning/setup/NavigationMenus/home"
  },
  {
    label: "Global Actions",
    section: "Org",
    url: "/lightning/setup/GlobalActions/home"
  },
  {
    label: "Publisher Layouts",
    section: "Org",
    url: "/lightning/setup/GlobalPublisherLayouts/home"
  }
];

export function escapeRegExp(value) {
  return (value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function escapeHtml(value) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Returns HTML-safe text with every occurrence of the term wrapped in <mark>.
 */
export function highlight(text, term) {
  const safeText = escapeHtml(text);
  const safeTerm = escapeHtml((term || "").trim());
  if (!safeTerm) {
    return safeText;
  }
  return safeText.replace(
    new RegExp(escapeRegExp(safeTerm), "gi"),
    "<mark>$&</mark>"
  );
}

export function containsIgnoreCase(haystack, needle) {
  return (haystack || "").toLowerCase().includes((needle || "").toLowerCase());
}

export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export async function copyToClipboard(text) {
  const value = text == null ? "" : String(text);
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  }
}

export function reduceErrors(error) {
  const errors = Array.isArray(error) ? error : [error];
  return errors
    .filter((e) => !!e)
    .map((e) => {
      if (Array.isArray(e.body)) {
        return e.body.map((b) => b.message).join(", ");
      }
      if (e.body?.message) {
        return e.body.message;
      }
      if (e.body?.output?.errors?.length) {
        return e.body.output.errors.map((b) => b.message).join(", ");
      }
      return e.message || String(e);
    })
    .join(", ");
}
