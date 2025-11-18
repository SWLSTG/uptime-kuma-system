const { NodeSDK } = require("@opentelemetry/sdk-node");
const { OTLPMetricExporter } = require("@opentelemetry/exporter-metrics-otlp-http");
const { PeriodicExportingMetricReader } = require("@opentelemetry/sdk-metrics");
const { resourceFromAttributes } = require("@opentelemetry/resources");
const { SemanticResourceAttributes, SEMRESATTRS_SERVICE_NAME, ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require("@opentelemetry/semantic-conventions");
const { version } = require("../package.json");
const { log } = require("../src/util");

let sdk = null;

class OpenTelemetry {
    /**
     * Initialize OpenTelemetry SDK.
     * @param {object} options Optional configuration for testing.
     * @param {PeriodicExportingMetricReader} options.metricReader A metric reader to use instead of the default.
     * @returns {void}
     */
    static init(options = {}) {
        if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT && !options.metricReader) {
            log.info("opentelemetry", "OTEL_EXPORTER_OTLP_ENDPOINT not set, OpenTelemetry metrics disabled.");
            return;
        }

        log.info("opentelemetry", "Initializing OpenTelemetry");

        let metricReader = options.metricReader;

        if (!metricReader) {
            const metricExporter = new OTLPMetricExporter({
                url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT + "/v1/metrics",
            });
            metricReader = new PeriodicExportingMetricReader({
                exporter: metricExporter,
                exportIntervalMillis: 15_000,
            });
        }

        const resource = new resourceFromAttributes({
            [ATTR_SERVICE_NAME]: "uptime-kuma",
            [ATTR_SERVICE_VERSION]: version,
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
