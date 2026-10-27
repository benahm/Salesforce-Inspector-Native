import LightningModal from "lightning/modal";
import findUsers from "@salesforce/apex/AccessService.findUsers";
import findUsersByLogin from "@salesforce/apex/AccessService.findUsersByLogin";
import getProfiles from "@salesforce/apex/AccessService.getProfiles";
import { debounce, mergeSelection, parseLogins, reduceErrors } from "c/utils";

const MAX_USERS = 200;

const LEVEL_OPTIONS = [
  { label: "User: the launcher and all its tools", value: "User" },
  {
    label: "Admin: also the SF Inspector Setup tab, to manage the access",
    value: "Admin"
  }
];

const COLUMNS = [
  { label: "Name", fieldName: "name" },
  { label: "Username", fieldName: "username" },
  { label: "Profile", fieldName: "profileName" },
  { label: "Current access", fieldName: "levelLabel", initialWidth: 130 }
];

function plural(count) {
  return count === 1 ? "1 user" : `${count} users`;
}

/**
 * Adds users to SF Inspector: pick the access level, then users from several
 * searches or from a pasted list of usernames or emails. Closes with
 * { userIds, level }, the users whose access changes.
 */
export default class AccessAddModal extends LightningModal {
  levelOptions = LEVEL_OPTIONS;
  columns = COLUMNS;

  level = "User";
  error;
  isSearching = false;

  isPasteMode = false;
  searchTerm = "";
  profileId = "";
  profiles = [];
  pasteText = "";
  pasteResult;

  results = [];
  // Selected rows by user id, kept across searches
  selected = {};

  static show() {
    return AccessAddModal.open({
      size: "medium",
      label: "Add users to SF Inspector"
    });
  }

  constructor() {
    super();
    this.debouncedSearch = debounce(() => this.search(), 300);
  }

  async connectedCallback() {
    try {
      this.profiles = await getProfiles();
    } catch (error) {
      this.error = reduceErrors(error);
    }
  }

  // ---- Getters ----

  get profileOptions() {
    return [
      { label: "All profiles", value: "" },
      ...this.profiles.map((p) => ({
        label: `${p.name} (${p.userCount})`,
        value: p.id
      }))
    ];
  }

  get pasteToggleLabel() {
    return this.isPasteMode ? "Search instead" : "Paste a list";
  }

  get pasteToggleIcon() {
    return this.isPasteMode ? "utility:search" : "utility:paste";
  }

  get pastePlaceholder() {
    return "alice@example.com\nbob@example.com\n…";
  }

  get rows() {
    return this.results.map((row) => ({
      ...row,
      levelLabel: row.level || "None"
    }));
  }

  get hasResults() {
    return this.results.length > 0;
  }

  get isResultLimit() {
    return !this.isPasteMode && this.results.length >= MAX_USERS;
  }

  get hasCriteria() {
    return this.searchTerm.trim().length >= 2 || !!this.profileId;
  }

  get emptyMessage() {
    if (this.isPasteMode) {
      return "Paste usernames or emails, one per line or separated by commas.";
    }
    return this.hasCriteria
      ? "No active user found."
      : "Search by name, or pick a profile to list its users.";
  }

  get selectedIds() {
    return Object.keys(this.selected);
  }

  get pills() {
    return Object.values(this.selected).map((row) => ({
      label: row.name,
      name: row.userId
    }));
  }

  get hasSelection() {
    return this.selectedIds.length > 0;
  }

  get selectionTitle() {
    return `Selected (${this.selectedIds.length})`;
  }

  // Users who already have the chosen level are left as they are
  get changingRows() {
    return Object.values(this.selected).filter(
      (row) => row.level !== this.level
    );
  }

  get selectionNote() {
    const notes = [];
    const unchanged = this.selectedIds.length - this.changingRows.length;
    if (unchanged) {
      notes.push(`${plural(unchanged)} already ${this.level}: no change.`);
    }
    const otherLevel = this.changingRows.filter((row) => row.level);
    if (otherLevel.length) {
      notes.push(
        `${plural(otherLevel.length)} with ${otherLevel[0].level} access will become ${this.level}.`
      );
    }
    return notes.join(" ");
  }

  get submitLabel() {
    const count = this.changingRows.length;
    return count
      ? `Give ${this.level} access to ${plural(count)}`
      : `Give ${this.level} access`;
  }

  get cannotSubmit() {
    return this.changingRows.length === 0;
  }

  // ---- Handlers ----

  handleLevel(event) {
    this.level = event.detail.value;
  }

  handleTogglePaste() {
    this.isPasteMode = !this.isPasteMode;
    this.results = [];
    this.pasteResult = undefined;
    if (!this.isPasteMode && this.hasCriteria) {
      this.search();
    }
  }

  handleSearchTerm(event) {
    this.searchTerm = event.target.value;
    this.debouncedSearch();
  }

  handleProfile(event) {
    this.profileId = event.detail.value;
    this.search();
  }

  handlePasteText(event) {
    this.pasteText = event.target.value;
  }

  handleRowSelection(event) {
    const byId = { ...this.selected };
    for (const row of this.results) {
      byId[row.userId] = row;
    }
    const ids = mergeSelection(
      this.selectedIds,
      this.results.map((row) => row.userId),
      event.detail.selectedRows.map((row) => row.userId)
    );
    this.selected = Object.fromEntries(ids.map((id) => [id, byId[id]]));
  }

  handleRemovePill(event) {
    const selected = { ...this.selected };
    delete selected[event.detail.item.name];
    this.selected = selected;
  }

  handleClearSelection() {
    this.selected = {};
  }

  handleCancel() {
    this.close();
  }

  handleSubmit() {
    this.close({
      userIds: this.changingRows.map((row) => row.userId),
      level: this.level
    });
  }

  // ---- Data ----

  async search() {
    this.error = undefined;
    if (!this.hasCriteria) {
      this.results = [];
      return;
    }
    this.isSearching = true;
    try {
      this.results = await findUsers({
        searchTerm: this.searchTerm,
        profileId: this.profileId || null
      });
    } catch (error) {
      this.results = [];
      this.error = reduceErrors(error);
    } finally {
      this.isSearching = false;
    }
  }

  async handleFindPasted() {
    const logins = parseLogins(this.pasteText);
    if (!logins.length) {
      return;
    }
    this.error = undefined;
    this.isSearching = true;
    try {
      const searched = logins.slice(0, MAX_USERS);
      this.results = await findUsersByLogin({ logins: searched });
      const matched = new Set(
        this.results.flatMap((row) => [
          row.username.toLowerCase(),
          (row.email || "").toLowerCase()
        ])
      );
      const notFound = searched.filter((login) => !matched.has(login));
      // Pasted users are selected right away
      const selected = { ...this.selected };
      for (const row of this.results) {
        selected[row.userId] = row;
      }
      this.selected = selected;
      this.pasteResult = {
        found: `${plural(this.results.length)} found and selected.`,
        notFound: notFound.length
          ? `Not found or inactive (${notFound.length}): ${notFound.join(", ")}`
          : "",
        skipped:
          logins.length > MAX_USERS
            ? `Only the first ${MAX_USERS} lines were searched.`
            : ""
      };
    } catch (error) {
      this.results = [];
      this.error = reduceErrors(error);
    } finally {
      this.isSearching = false;
    }
  }
}
