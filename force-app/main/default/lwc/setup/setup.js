import { LightningElement } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getStatus from "@salesforce/apex/SFI_SetupService.getStatus";
import addGlobalAction from "@salesforce/apex/SFI_SetupService.addGlobalAction";
import removeGlobalAction from "@salesforce/apex/SFI_SetupService.removeGlobalAction";
import SFI_ASSETS from "@salesforce/resourceUrl/sfiAssets";
import { RELEASES_URL, VERSION, reduceErrors } from "c/utils";

// The Apex deployment is queued: the layout is read again until it changes,
// for up to 5 minutes (from seconds to about 3 minutes in scratch orgs).
const POLL_INTERVAL_MS = 3000;
const POLL_ATTEMPTS = 100;

export default class Setup extends LightningElement {
  status;
  error;
  isLoading = false;
  isDeploying = false;

  logoUrl = `${SFI_ASSETS}/images/logo-beta.svg`;
  version = VERSION;
  releasesUrl = RELEASES_URL;

  apexSettingsUrl = "/lightning/setup/ApexSettings/home";
  deployStatusUrl = "/lightning/setup/DeployStatus/home";
  publisherLayoutsUrl = "/lightning/setup/GlobalPublisherLayouts/home";

  connectedCallback() {
    this.load();
  }

  disconnectedCallback() {
    clearTimeout(this.pollTimeout);
  }

  async load() {
    this.isLoading = true;
    this.error = undefined;
    try {
      this.status = await getStatus();
    } catch (error) {
      this.error = reduceErrors(error);
    } finally {
      this.isLoading = false;
    }
  }

  get layoutName() {
    return this.status?.layoutName || "Global Layout";
  }

  get statusLabel() {
    if (this.isDeploying) {
      return "Deploying";
    }
    return this.status.hasGlobalAction ? "Added" : "Not added";
  }

  get statusClass() {
    return this.status.hasGlobalAction && !this.isDeploying
      ? "slds-theme_success"
      : "slds-badge_lightest";
  }

  get cannotCustomize() {
    return this.status && !this.status.canCustomize;
  }

  handleAdd() {
    this.deploy(addGlobalAction, true);
  }

  handleRemove() {
    this.deploy(removeGlobalAction, false);
  }

  async deploy(action, expected) {
    this.error = undefined;
    this.isDeploying = true;
    try {
      await action();
      this.poll(expected, POLL_ATTEMPTS);
    } catch (error) {
      this.isDeploying = false;
      this.error = reduceErrors(error);
    }
  }

  poll(expected, attemptsLeft) {
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.pollTimeout = setTimeout(async () => {
      try {
        this.status = await getStatus();
      } catch (error) {
        this.isDeploying = false;
        this.error = reduceErrors(error);
        return;
      }
      if (this.status.hasGlobalAction === expected) {
        this.isDeploying = false;
        this.toast(
          expected
            ? "SF Inspector added to the global actions. Reload the page to see it."
            : "SF Inspector removed from the global actions."
        );
      } else if (attemptsLeft > 1) {
        this.poll(expected, attemptsLeft - 1);
      } else {
        this.isDeploying = false;
        this.error =
          "The layout did not change yet. Check Setup › Deployment Status.";
      }
    }, POLL_INTERVAL_MS);
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
