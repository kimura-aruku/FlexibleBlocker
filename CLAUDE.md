# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlexibleBlocker is a Chrome extension (Manifest V3) that blocks access to specified websites during configured time periods, redirecting users to a warning page when blocked sites are accessed during restricted hours.

## Development

This is a simple Chrome extension without build tools or package management. Files are loaded directly by Chrome.

### Loading the Extension for Testing
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" 
3. Click "Load unpacked" and select this directory
4. The extension will be loaded and ready for testing

### No Build Commands
This extension uses vanilla JavaScript and HTML - no build step required. Changes to files take effect immediately after reloading the extension in Chrome.

## Architecture

The extension follows standard Chrome Extension Manifest V3 patterns:

### Core Files (per 仕様書.md):
- `manifest.json` - Extension manifest defining permissions and entry points
- `content.js` - Content script for site access detection and redirect logic (currently empty)
- `background.js` - Service worker for background processing (referenced in manifest but not yet created)
- `options.html` & `options.js` - Settings UI for configuring blocked sites and time periods (not yet created)
- `block.html` - Warning page shown when sites are blocked (not yet created)

### Data Storage
Extension uses Chrome's `storage` API (permission declared in manifest) to persist user settings locally.

### URL Blocking Logic
Extension has `<all_urls>` host permission and `webNavigation` permission to monitor and control all web traffic.

## Current State
The project has basic structure with manifest.json and empty content.js. Core functionality (blocking logic, options UI, warning page) needs to be implemented according to the specifications in 仕様書.md.