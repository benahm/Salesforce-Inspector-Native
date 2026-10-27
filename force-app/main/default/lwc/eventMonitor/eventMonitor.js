import { LightningElement, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import LightningConfirm from "lightning/confirm";
import {
  isEmpEnabled,
  onError,
  subscribe,
  unsubscribe
} from "lightning/empApi";
import getChannels from "@salesforce/apex/EventService.getChannels";
import { containsIgnoreCase, copyToClipboard, reduceErrors } from "c/utils";

const MANUAL = "manual";
const MAX_EVENTS = 500;

export default class EventMonitor extends LightningElement {
  channelType = "platformEvent";
  channelTypes = [
    { label: "Custom Platform Event", value: "platformEvent" },
    { label: "Standard Platform Event", value: "standardPlatformEvent" },
    { label: "Change Event", value: "changeEvent" },
    { label: "Other channel (typed)", value: MANUAL }
  ];
  channels = [];
  channelPath = "";
  replayId = "-1";
  replayOptions = [
    { label: "New events only (-1)", value: "-1" },
    { label: "All stored events (-2)", value: "-2" }
  ];
  isLoadingChannels = false;
  subscription;
  isSubscribing = false;
  events = [];
  filter = "";
  error;
  empEnabled = true;
  sequence = 0;

  connectedCallback() {
    isEmpEnabled().then((enabled) => {
      this.empEnabled = enabled;
    });
    onError((error) => {
      this.error = `Streaming error: ${JSON.stringify(error)}`;
      this.subscription = undefined;
    });
    this.loadChannels();
  }

  disconnectedCallback() {
    if (this.subscription) {
      unsubscribe(this.subscription, () => {});
    }
  }

  @wire(CurrentPageReference)
  handlePageReference(pageReference) {
    const channel = pageReference?.state?.c__channel;
    if (channel && !this.channelPath) {
      this.channelPath = channel;
    }
  }

  async loadChannels() {
    this.channels = [];
    if (this.channelType === MANUAL) {
      return;
    }
    this.isLoadingChannels = true;
    try {
      const channels = await getChannels({ channelType: this.channelType });
      this.channels = channels.map((c) => ({
        label: `${c.label} (${c.path})`,
        value: c.path
      }));
    } catch (error) {
      this.error = reduceErrors(error);
    } finally {
      this.isLoadingChannels = false;
    }
  }

  get isManual() {
    return this.channelType === MANUAL;
  }

  get channelPlaceholder() {
    return this.isLoadingChannels ? "Loading..." : "Select an event";
  }

  get isSubscribed() {
    return !!this.subscription;
  }

  get subscribeDisabled() {
    return !this.channelPath || this.isSubscribing || !this.empEnabled;
  }

  get settingsDisabled() {
    return this.isSubscribed || this.isSubscribing;
  }

  get statusLabel() {
    if (this.isSubscribing) {
      return "Subscribing...";
    }
    return this.isSubscribed
      ? `Listening on ${this.subscription.channel}`
      : "Not subscribed";
  }

  get statusClass() {
    return this.isSubscribed
      ? "slds-badge slds-theme_success"
      : "slds-badge slds-badge_lightest";
  }

  get eventRows() {
    return this.events.filter((e) => containsIgnoreCase(e.json, this.filter));
  }

  get countLabel() {
    const shown = this.eventRows.length;
    const total = this.events.length;
    const unit = total === 1 ? "event" : "events";
    return shown === total ? `${total} ${unit}` : `${shown} / ${total} ${unit}`;
  }

  get hasNoEvents() {
    return this.eventRows.length === 0;
  }

  get emptyLabel() {
    return this.isSubscribed
      ? "Waiting for events..."
      : "Pick a channel and subscribe to see its events here.";
  }

  handleChannelType(event) {
    this.channelType = event.detail.value;
    this.channelPath = "";
    this.loadChannels();
  }

  handleChannel(event) {
    this.channelPath = event.detail.value;
  }

  handleChannelPath(event) {
    this.channelPath = event.target.value.trim();
  }

  handleReplay(event) {
    this.replayId = event.detail.value;
  }

  handleFilter(event) {
    this.filter = event.target.value;
  }

  async handleSubscribe() {
    if (this.replayId === "-2") {
      const confirmed = await LightningConfirm.open({
        label: "Replay all stored events?",
        message:
          "Replaying from -2 returns every event retained for this channel (up to 72 hours) and can be a lot of messages.",
        theme: "warning"
      });
      if (!confirmed) {
        return;
      }
    }
    this.error = undefined;
    this.isSubscribing = true;
    try {
      this.subscription = await subscribe(
        this.channelPath,
        Number(this.replayId),
        (message) => this.addEvent(message)
      );
    } catch (error) {
      this.error = reduceErrors(error);
    } finally {
      this.isSubscribing = false;
    }
  }

  handleUnsubscribe() {
    const subscription = this.subscription;
    this.subscription = undefined;
    unsubscribe(subscription, () => {});
  }

  addEvent(message) {
    const data = message.data || {};
    const payload = data.payload || {};
    const header = payload.ChangeEventHeader;
    this.sequence += 1;
    const row = {
      key: `${data.event?.replayId ?? ""}-${this.sequence}`,
      replayId: data.event?.replayId,
      receivedAt: new Date().toLocaleTimeString(),
      channel: message.channel,
      summary: header
        ? `${header.changeType} ${header.entityName} ${(header.recordIds || []).join(", ")}`
        : message.channel,
      json: JSON.stringify(data, null, 2)
    };
    this.events = [row, ...this.events].slice(0, MAX_EVENTS);
  }

  handleClear() {
    this.events = [];
  }

  async handleCopy(event) {
    const value = event.currentTarget.dataset.value;
    const copied = await copyToClipboard(value);
    this.dispatchEvent(
      new ShowToastEvent({
        title: copied ? "Copied to clipboard" : "Copy failed",
        variant: copied ? "success" : "error"
      })
    );
  }

  handleCopyAll() {
    const all = this.eventRows.map((e) => JSON.parse(e.json));
    this.handleCopy({
      currentTarget: { dataset: { value: JSON.stringify(all, null, 2) } }
    });
  }
}
