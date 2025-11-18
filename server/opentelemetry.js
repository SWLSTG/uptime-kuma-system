const { NodeSDK } = require("@opentelemetry/sdk-node");
const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-http");
const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");
const { Resource } = require("@opentelemetry/resources");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");
const { version } = require("../package.json");
const { log } = require("../src/util");

let sdk = null;

class OpenTelemetry {
    /**
     * Initialize OpenTelemetry SDK
     * @returns {void}
     */
    static init() {
        if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
            log.info("opentelemetry", "OTEL_EXPORTER_OTLP_ENDPOINT not set, OpenTelemetry metrics disabled.");
            return;
        }

        log.info("opentelemetry", "Initializing OpenTelemetry");

        const metricExporter = new OTLPMetricExporter({
            url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + "/v1/metrics",
        });
        const metricReader = new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: 15_000,
        });

        const resource = new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: "uptime-kuma",
            [SemanticResourceAttributes.SERVICE_VERSION]: version,
        });

        sdk = new NodeSDK({
            metricReader: metricReader,
            resource: resource,
        });

        sdk.start();
        log.info("opentelemetry", "OpenTelemetry started");
    }

    static async shutdown() {
        await sdk?.shutdown();
    }
}

module.exports = { OpenTelemetry };