include $(TOPDIR)/rules.mk

LUCI_TITLE:=Dashboard with per-client bandwidth monitor
LUCI_DEPENDS:=+luci-base +rpcd-mod-ucode +ucode-mod-fs +ucode-mod-uci +firewall4 +nftables-json
LUCI_PKGARCH:=all
PKG_VERSION:=1.0.5
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
