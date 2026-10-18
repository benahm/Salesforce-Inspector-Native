import { LightningElement } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getLimits from "@salesforce/apex/SFI_LimitsService.getLimits";
import { containsIgnoreCase, copyToClipboard, reduceErrors } from "c/sfiUtils";

// "DailyApiRequests" -> "Daily Api Requests"
function toLabel(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function levelClass(percent) {
  if (percent >= 90) {
    return "sfi-critical";
  }
  return percent >= 70 ? "sfi-warning" : "sfi-ok";
}

export default class SfiOrgLimits extends LightningElement {
  limits = [];
  error;
  isLoading = false;
  filter = "";
  sortBy = "consumption";
  sortOptions = [
    { label: "Consumption", value: "consumption" },
    { label: "Name", value: "name" }
  ];

  connectedCallback() {
    this.load();
  }

  async load() {
    this.isLoading = true;
    this.error = undefined;
    try {
      this.limits = await getLimits();
    } catch (error) {
      this.error = reduceErrors(error);
    } finally {
      this.isLoading = false;
    }
  }

  get rows() {
    const rows = this.limits
      .map((item) => {
        // "0 of 0 consumed" means the limit does not apply to this org (SFIR)
        const notApplicable = item.max === 0 && item.used === 0;
        const percent = notApplicable
          ? 0
          : Math.round((item.used / (item.max || 1)) * 100);
        const remaining = item.max - item.used;
        return {
          ...item,
          label: toLabel(item.name),
          percent,
          percentLabel: notApplicable ? "n/a" : `${percent}%`,
          barStyle: `width: ${Math.min(percent, 100)}%`,
          barClass: `sfi-bar-value ${levelClass(percent)}`,
          detail: `${item.used.toLocaleString()} of ${item.max.toLocaleString()} consumed`,
          remainingLabel:
            remaining >= 0
              ? `${remaining.toLocaleString()} left`
              : `${(-remaining).toLocaleString()} overconsumed`
        };
      })
      .filter(
        (row) =>
          containsIgnoreCase(row.name, this.filter) ||
          containsIgnoreCase(row.label, this.filter)
      );
    return this.sortBy === "name"
      ? rows.sort((a, b) => a.name.localeCompare(b.name))
      : rows.sort(
          (a, b) => b.percent - a.percent || a.name.localeCompare(b.name)
        );
  }

  get countLabel() {
    return `${this.rows.length} / ${this.limits.length} limits`;
  }

  get hasNoRows() {
    return !this.isLoading && !this.error && this.rows.length === 0;
  }

  handleFilter(event) {
    this.filter = event.target.value;
  }

  handleSort(event) {
    this.sortBy = event.detail.value;
  }

  handleRefresh() {
    this.load();
  }

  // Same shape as REST /limits, like SFIR's "Copy as JSON"
  async handleCopyJson() {
    const json = {};
    this.limits.forEach((item) => {
      json[item.name] = { Max: item.max, Remaining: item.max - item.used };
    });
    const copied = await copyToClipboard(JSON.stringify(json, null, 2));
    this.dispatchEvent(
      new ShowToastEvent({
        title: copied ? "Copied to clipboard" : "Copy failed",
        variant: copied ? "success" : "error"
      })
    );
  }
}
