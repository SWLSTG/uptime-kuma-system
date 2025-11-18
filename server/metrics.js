const { metrics } = require("@opentelemetry/api");
const { log } = require("../src/util");
const { R } = require("redbean-node");

let monitorCertDaysRemaining = null;
let monitorCertIsValid = null;
let monitorResponseTime = null;
let monitorStatus = null;

let meter;

class Metrics {
    attributes = {};

    /**
     * @param {object} monitor Monitor object to monitor
     * @param {Array<{name:string,value:?string}>} tags Tags to add to the monitor
     */
    constructor(monitor, tags) {
        this.attributes = {
            ...this.mapTagsToLabels(tags),
            monitor_id: monitor.id,
            monitor_name: monitor.name,
            monitor_type: monitor.type,
            monitor_url: monitor.url,
            monitor_hostname: monitor.hostname,
            monitor_port: monitor.port
        };
    }

    /**
     * Initialize metrics.
     * This should be called once at the start of the application.
     * @returns {Promise<void>}
     */
    static async init() {
        meter = metrics.getMeter("uptime-kuma");

        monitorCertDaysRemaining = meter.createGauge("monitor_cert_days_remaining", {
            description: "The number of days remaining until the certificate expires",
        });

        monitorCertIsValid = meter.createGauge("monitor_cert_is_valid", {
            description: "Is the certificate still valid? (1 = Yes, 0= No)",
        });

        monitorResponseTime = meter.createGauge("monitor_response_time", {
            description: "Monitor Response Time (ms)",
        });

        monitorStatus = meter.createGauge("monitor_status", {
            description: "Monitor Status (1 = UP, 0= DOWN, 2= PENDING, 3= MAINTENANCE)",
        });
    }

    /**
     * Sanitize a string to ensure it can be used as a label or value.
     * @param {string} text The text to sanitize
     * @returns {string} The sanitized text
     */
    static sanitizeForPrometheus(text) {
        text = text.replace(/[^a-zA-Z0-9_]/g, "");
        text = text.replace(/^[^a-zA-Z_]+/, "");
        return text;
    }

    /**
     * Map the tags value to valid labels. Sanitize them in the process.
     * @param {Array<{name: string, value:?string}>} tags The tags to map
     * @returns {object} The mapped tags, usable as labels
     */
    mapTagsToLabels(tags) {
        let mappedTags = {};
        tags.forEach((tag) => {
            let sanitizedTag = Metrics.sanitizeForPrometheus(tag.name);
            if (sanitizedTag === "") {
                return; // Skip empty tag names
            }

            if (mappedTags[sanitizedTag] === undefined) {
                mappedTags[sanitizedTag] = [];
            }

            let tagValue = Metrics.sanitizeForPrometheus(tag.value || "");
            if (tagValue !== "") {
                mappedTags[sanitizedTag].push(tagValue);
            }

            mappedTags[sanitizedTag] = mappedTags[sanitizedTag].sort();
        });

        // Order the tags alphabetically
        return Object.keys(mappedTags).sort(this.sortTags).reduce((obj, key) => {
            obj[key] = mappedTags[key];
            return obj;
        }, {});
    }

    /**
     * Update the metrics
     * @param {object} heartbeat Heartbeat details
     * @param {object} tlsInfo TLS details
     * @returns {void}
     */
    update(heartbeat, tlsInfo) {
        if (typeof tlsInfo !== "undefined") {
            try {
                let isValid;
                if (tlsInfo.valid === true) {
                    isValid = 1;
                } else {
                    isValid = 0;
                }
                monitorCertIsValid.record(isValid, this.attributes);
            } catch (e) {
                log.error("metrics", "Caught error");
                log.error("metrics", e);
            }

            try {
                if (tlsInfo.certInfo != null && monitorCertDaysRemaining) {
                    monitorCertDaysRemaining.record(tlsInfo.certInfo.daysRemaining, this.attributes);
                }
            } catch (e) {
                log.error("metrics", "Caught error");
                log.error("metrics", e);
            }
        }

        if (heartbeat) {
            try {
                monitorStatus.record(heartbeat.status, this.attributes);
            } catch (e) {
                log.error("metrics", "Caught error");
                log.error("metrics", e);
            }

            try {
                if (typeof heartbeat.ping === "number" && monitorResponseTime) {
                    monitorResponseTime.record(heartbeat.ping, this.attributes);
                } else {
                    // Is it good?
                    monitorResponseTime.record(-1, this.attributes);
                }
            } catch (e) {
                log.error("metrics", "Caught error");
                log.error("metrics", e);
            }
        }
    }

    /**
     * Remove monitor from metrics
     * With OTLP, we don't need to remove metrics. They will stop being reported.
     * @returns {void}
     */
    remove() {
        // No-op for OpenTelemetry
    }

    /**
     * Sort the tags alphabetically, case-insensitive.
     * @param {string} a The first tag to compare
     * @param {string} b The second tag to compare
     * @returns {number} The alphabetical order number
     */
    sortTags(a, b) {
        const aLowerCase = a.toLowerCase();
        const bLowerCase = b.toLowerCase();

        if (aLowerCase < bLowerCase) {
            return -1;
        }

        if (aLowerCase > bLowerCase) {
            return 1;
        }

        return 0;
    }
}

module.exports = {
    Metrics
};