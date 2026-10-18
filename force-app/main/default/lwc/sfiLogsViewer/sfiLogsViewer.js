import { LightningElement } from "lwc";
import getLogs from "@salesforce/apex/SFI_LogService.getLogs";
import {
  containsIgnoreCase,
  DEBUG_LOGS_SETUP_URL,
  logDetailUrl,
  reduceErrors
} from "c/sfiUtils";

const MAX_ROWS = 500;

const COLUMNS = [
  {
    label: "Start time",
    fieldName: "startTime",
    type: "date",
    sortable: true,
    initialWidth: 170,
    typeAttributes: {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  },
  { label: "User", fieldName: "userName", sortable: true, initialWidth: 180 },
  { label: "Operation", fieldName: "operation", sortable: true },
  { label: "Request", fieldName: "request", sortable: true, initialWidth: 110 },
  { label: "Status", fieldName: "status", sortable: true },
  {
    label: "Size (KB)",
    fieldName: "sizeKb",
    type: "number",
    sortable: true,
    initialWidth: 100,
    typeAttributes: { maximumFractionDigits: 1 }
  },
  {
    label: "Duration (ms)",
    fieldName: "durationMs",
    type: "number",
    sortable: true,
    initialWidth: 120
  },
  {
    label: "",
    fieldName: "detailUrl",
    type: "url",
    initialWidth: 70,
    typeAttributes: {
      label: "View",
      target: "_blank",
      tooltip: "Open the log in Setup"
    }
  }
];

export default class SfiLogsViewer extends LightningElement {
  columns = COLUMNS;
  logs = [];
  error;
  isLoading = false;
  onlyMine = false;
  filter = "";
  sortedBy = "startTime";
  sortedDirection = "desc";
  debugLogsUrl = DEBUG_LOGS_SETUP_URL;

  connectedCallback() {
    this.load();
  }

  async load() {
    this.isLoading = true;
    this.error = undefined;
    try {
      const logs = await getLogs({
        onlyMine: this.onlyMine,
        maxRows: MAX_ROWS
      });
      this.logs = logs.map((log) => ({
        ...log,
        sizeKb: log.size / 1024,
        detailUrl: logDetailUrl(log.id)
      }));
    } catch (error) {
      this.logs = [];
      this.error = reduceErrors(error);
    } finally {
      this.isLoading = false;
    }
  }

  get rows() {
    const rows = this.logs.filter(
      (log) =>
        !this.filter ||
        [log.userName, log.operation, log.request, log.status].some((value) =>
          containsIgnoreCase(value, this.filter)
        )
    );
    const field = this.sortedBy;
    const direction = this.sortedDirection === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      const left = a[field] ?? "";
      const right = b[field] ?? "";
      if (left < right) {
        return -direction;
      }
      return left > right ? direction : 0;
    });
  }

  get countLabel() {
    const shown = this.rows.length;
    const total = this.logs.length;
    const unit = total === 1 ? "log" : "logs";
    const limit = total >= MAX_ROWS ? ` (latest ${MAX_ROWS})` : "";
    return shown === total
      ? `${total} ${unit}${limit}`
      : `${shown} / ${total} ${unit}${limit}`;
  }

  get hasNoLogs() {
    return !this.isLoading && !this.error && this.rows.length === 0;
  }

  handleOnlyMine(event) {
    this.onlyMine = event.target.checked;
    this.load();
  }

  handleFilter(event) {
    this.filter = event.target.value;
  }

  handleSort(event) {
    this.sortedBy = event.detail.fieldName;
    this.sortedDirection = event.detail.sortDirection;
  }

  handleRefresh() {
    this.load();
  }
}
