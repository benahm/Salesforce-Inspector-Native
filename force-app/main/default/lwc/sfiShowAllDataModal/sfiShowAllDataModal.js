import { api } from "lwc";
import LightningModal from "lightning/modal";

/**
 * Show All Data in a modal, opened from the launcher.
 */
export default class SfiShowAllDataModal extends LightningModal {
  @api recordId;

  static show(recordId) {
    return SfiShowAllDataModal.open({
      size: "full",
      label: "Show All Data",
      recordId
    });
  }
}
