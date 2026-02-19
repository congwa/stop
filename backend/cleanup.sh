#!/bin/bash
# Stop Cleanup Script
# This script is called by the LaunchAgent when Stop exits (including force-quit).
# It ejects the RAM disk and removes global rules.

SENTINEL="$HOME/.stop_running"
RAM_DISK_NAME="StopRules"
GLOBAL_RULES="$HOME/.codeium/windsurf/memories/global_rules.md"

# Check if Stop process is still running
if [ -f "$SENTINEL" ]; then
    PID=$(cat "$SENTINEL" 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        exit 0
    fi
fi

# Stop is not running - clean up
if [ -d "/Volumes/$RAM_DISK_NAME" ]; then
    diskutil eject "$RAM_DISK_NAME" 2>/dev/null || hdiutil detach "/Volumes/$RAM_DISK_NAME" -force 2>/dev/null
fi

if [ -f "$GLOBAL_RULES" ]; then
    rm -f "$GLOBAL_RULES"
fi

rm -f "$SENTINEL"
