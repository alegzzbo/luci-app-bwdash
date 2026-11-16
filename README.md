# luci-app-bwdash
Dashboard + per-client bandwidth monitor for OpenWrt 25.12 (apk, fw4/nftables). Replaces luci-app-wrtbwmon + luci-mod-dashboard.
Install: `apk add --allow-untrusted ./luci-app-bwdash-*.apk`
Config: /etc/config/bwdash (lan_dev, db). Disable flow offloading, otherwise offloaded flows are not counted.
