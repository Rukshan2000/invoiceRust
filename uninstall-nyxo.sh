#!/bin/bash
# =============================================
# Script: uninstall-nyxo.sh
# Purpose: Fully remove NyxoWealth Billing App
# =============================================

APP_PACKAGE="nyxo-wealth-billing-manager"
APP_DATA_DIR="$HOME/.local/share/com.nyxowealth.billing"
APP_CONFIG_DIR="$HOME/.config/com.nyxowealth.billing"

echo "==== NyxoWealth Billing Uninstall Script ===="

# 1️⃣ Remove the package if installed
if dpkg -l | grep -q "$APP_PACKAGE"; then
    echo "Removing package: $APP_PACKAGE"
    sudo apt remove -y "$APP_PACKAGE"
else
    echo "Package $APP_PACKAGE not found, skipping removal."
fi

# 2️⃣ Purge package completely (just in case)
if dpkg -l | grep -q "$APP_PACKAGE"; then
    echo "Purging package: $APP_PACKAGE"
    sudo apt purge -y "$APP_PACKAGE"
fi

# 3️⃣ Remove leftover dependencies
echo "Cleaning up unused dependencies..."
sudo apt autoremove -y

# 4️⃣ Remove local data folder
if [ -d "$APP_DATA_DIR" ]; then
    echo "Removing app data: $APP_DATA_DIR"
    rm -rf "$APP_DATA_DIR"
else
    echo "No local app data found at $APP_DATA_DIR"
fi

# 5️⃣ Remove config folder
if [ -d "$APP_CONFIG_DIR" ]; then
    echo "Removing config: $APP_CONFIG_DIR"
    rm -rf "$APP_CONFIG_DIR"
else
    echo "No config folder found at $APP_CONFIG_DIR"
fi

echo "==== NyxoWealth Billing has been fully removed! ===="
