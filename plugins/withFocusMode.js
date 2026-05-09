const {
  withAndroidManifest,
  withDangerousMod,
  withStringsXml,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withAccessibilityServiceConfig(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      const xmlPath = path.join(xmlDir, "accessibility_service_config.xml");

      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }

      fs.writeFileSync(
        xmlPath,
        `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault"
    android:canRetrieveWindowContent="false"
    android:notificationTimeout="100" />`,
      );

      return config;
    },
  ]);
}

// 👇 Inject the string into strings.xml
function withAccessibilityString(config) {
  return withStringsXml(config, (config) => {
    const strings = config.modResults.resources.string ?? [];
    const alreadyAdded = strings.some(
      (s) => s.$?.name === "accessibility_service_description",
    );
    if (!alreadyAdded) {
      strings.push({
        $: { name: "accessibility_service_description" },
        _: "Muraqib uses this to remind you to complete your recitation during your scheduled time.",
      });
      config.modResults.resources.string = strings;
    }
    return config;
  });
}

function withFocusModeManifest(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    const services = application.service ?? [];
    const alreadyAdded = services.some(
      (s) => s.$?.["android:name"] === ".FocusModeService",
    );

    if (!alreadyAdded) {
      services.push({
        $: {
          "android:name": ".FocusModeService",
          "android:exported": "true",
          "android:label": "Muraqib Focus Mode",
          "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name":
                    "android.accessibilityservice.AccessibilityService",
                },
              },
            ],
          },
        ],
        "meta-data": [
          {
            $: {
              "android:name": "android.accessibilityservice",
              "android:resource": "@xml/accessibility_service_config",
            },
          },
        ],
      });
      application.service = services;
    }

    return config;
  });
}

module.exports = function withFocusMode(config) {
  config = withAccessibilityServiceConfig(config);
  config = withAccessibilityString(config); // 👈 added
  config = withFocusModeManifest(config);
  return config;
};
