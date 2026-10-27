import { LightningElement } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import LightningConfirm from "lightning/confirm";
import getAccessList from "@salesforce/apex/AccessService.getAccessList";
import setAccess from "@salesforce/apex/AccessService.setAccess";
import AccessAddModal from "c/accessAddModal";
import { containsIgnoreCase, mergeSelection, reduceErrors } from "c/utils";

const COLUMNS = [
  { label: "Name", fieldName: "displayName" },
  { label: "Username", fieldName: "username" },
  { label: "Profile", fieldName: "profileName" },
  { label: "Access", fieldName: "level", initialWidth: 100 }
];

const ROW_ACTIONS = {
  type: "action",
  typeAttributes: {
    rowActions: [
      { label: "Set User", name: "User" },
      { label: "Set Admin", name: "Admin" },
      { label: "Remove access", name: "" }
    ]
  }
};

function plural(count) {
  return count === 1 ? "1 user" : `${count} users`;
}

/**
 * Access section of the Setup tab: the users holding the User or the Admin
 * permission set, changed many at once. Users are added from a modal.
 */
export default class SetupAccess extends LightningElement {
  accessList;
  error;
  isLoading = false;
  isSaving = false;
  levelFilter = "";
  filterTerm = "";
  selectedIds = [];

  connectedCallback() {
    this.load();
  }

  async load() {
    this.isLoading = true;
    this.error = undefined;
    try {
      this.accessList = await getAccessList();
    } catch (error) {
      this.error = reduceErrors(error);
    } finally {
      this.isLoading = false;
    }
  }

  // ---- Getters ----

  get canAssign() {
    return this.accessList?.canAssign === true;
  }

  get cannotAssign() {
    return this.accessList?.canAssign === false;
  }

  get isBusy() {
    return this.isLoading || this.isSaving;
  }

  get columns() {
    return this.canAssign ? [...COLUMNS, ROW_ACTIONS] : COLUMNS;
  }

  get rows() {
    return (this.accessList?.rows || []).map((row) => ({
      ...row,
      displayName: displayName(row)
    }));
  }

  get hasRows() {
    return this.rows.length > 0;
  }

  get adminCount() {
    return this.rows.filter((row) => row.level === "Admin").length;
  }

  get userCount() {
    return this.rows.length - this.adminCount;
  }

  get summary() {
    if (!this.accessList) {
      return "Who can use SF Inspector.";
    }
    const admins =
      this.adminCount === 1 ? "1 Admin" : `${this.adminCount} Admins`;
    const users = this.userCount === 1 ? "1 User" : `${this.userCount} Users`;
    return `${admins} · ${users}. Admins also get this Setup tab.`;
  }

  get levelFilterOptions() {
    return [
      { label: `All (${this.rows.length})`, value: "" },
      { label: `Admins (${this.adminCount})`, value: "Admin" },
      { label: `Users (${this.userCount})`, value: "User" }
    ];
  }

  get shownRows() {
    return this.rows.filter(
      (row) =>
        (!this.levelFilter || row.level === this.levelFilter) &&
        (containsIgnoreCase(row.name, this.filterTerm) ||
          containsIgnoreCase(row.username, this.filterTerm) ||
          containsIgnoreCase(row.profileName, this.filterTerm))
    );
  }

  get hasShownRows() {
    return this.shownRows.length > 0;
  }

  get hasSelection() {
    return this.selectedIds.length > 0;
  }

  get selectionLabel() {
    return `${plural(this.selectedIds.length)} selected`;
  }

  // ---- Handlers ----

  handleLevelFilter(event) {
    this.levelFilter = event.detail.value;
  }

  handleFilterTerm(event) {
    this.filterTerm = event.target.value;
  }

  handleRowSelection(event) {
    this.selectedIds = mergeSelection(
      this.selectedIds,
      this.shownRows.map((row) => row.userId),
      event.detail.selectedRows.map((row) => row.userId)
    );
  }

  handleClearSelection() {
    this.selectedIds = [];
  }

  handleRowAction(event) {
    this.change([event.detail.row.userId], event.detail.action.name || null);
  }

  handleSetSelected(event) {
    this.change(this.selectedIds, event.target.dataset.level || null);
  }

  async handleAddUsers() {
    const result = await AccessAddModal.show();
    if (result?.userIds?.length) {
      this.change(result.userIds, result.level);
    }
  }

  async change(userIds, level) {
    if (!userIds.length) {
      return;
    }
    const currentUser = (this.accessList?.rows || []).find(
      (row) => row.isCurrentUser
    );
    const lowersOwnAccess =
      currentUser &&
      userIds.includes(currentUser.userId) &&
      level !== currentUser.level &&
      level !== "Admin";
    if (lowersOwnAccess && !(await confirmOwnChange(level))) {
      return;
    }
    this.isSaving = true;
    this.error = undefined;
    try {
      this.accessList = await setAccess({ userIds, level });
      this.selectedIds = [];
      this.toast(
        level
          ? `${plural(userIds.length)}: ${level} access.`
          : `${plural(userIds.length)}: access removed.`
      );
    } catch (error) {
      this.error = reduceErrors(error);
    } finally {
      this.isSaving = false;
    }
  }

  toast(message) {
    this.dispatchEvent(
      new ShowToastEvent({
        title: "SF Inspector Setup",
        message,
        variant: "success"
      })
    );
  }
}

function displayName(user) {
  const notes = [];
  if (user.isCurrentUser) {
    notes.push("you");
  }
  if (!user.isActive) {
    notes.push("inactive");
  }
  return notes.length ? `${user.name} (${notes.join(", ")})` : user.name;
}

// Lowering your own access hides this tab, or the whole app.
function confirmOwnChange(level) {
  return LightningConfirm.open({
    label: "Change your own access?",
    message:
      level === "User"
        ? "You will lose access to this Setup tab."
        : "You will lose access to SF Inspector.",
    theme: "warning"
  });
}
