// controller.js - Universal Remote Control

var display = require("display");
var wifi = require("wifi");
var keyboard = require("keyboard");

var sprite = display.createSprite();

// ============================================
// CONFIGURATION
// ============================================
var SSID = "iPhone14";
var PASSWORD = "password";
var DONGLE_IP = "4.3.2.1";
var WIFI_TIMEOUT = 10;

// ============================================
// SETTINGS (loaded from SD if available)
// ============================================
var settingsLED = true;
var motionBlurEnabled = true;
var textOutlineEnabled = true;

// ============================================
// COLOR THEMES
// ============================================
var customTextRGB = { r: 255, g: 255, b: 255 };
var customBgRGB = { r: 0, g: 0, b: 0 };
var customAccentRGB = { r: 0, g: 255, b: 0 };

var activeRGB = null;

var namedColors = {
    white: { r: 255, g: 255, b: 255 },
    red:   { r: 255, g: 0,   b: 0   },
    green: { r: 0,   g: 255, b: 0   },
    blue:  { r: 0,   g: 0,   b: 255 }
};

var presetThemes = {
    white: {
        label: "White",
        textRGB: { r: 255, g: 255, b: 255 },
        bgRGB: { r: 0, g: 0, b: 0 },
        accentRGB: { r: 0, g: 255, b: 0 }
    },
    red: {
        label: "Red",
        textRGB: { r: 255, g: 0, b: 0 },
        bgRGB: { r: 0, g: 0, b: 0 },
        accentRGB: { r: 255, g: 255, b: 0 }
    },
    green: {
        label: "Green",
        textRGB: { r: 0, g: 255, b: 0 },
        bgRGB: { r: 0, g: 0, b: 0 },
        accentRGB: { r: 255, g: 255, b: 0 }
    },
    blue: {
        label: "Blue",
        textRGB: { r: 0, g: 0, b: 255 },
        bgRGB: { r: 0, g: 0, b: 0 },
        accentRGB: { r: 255, g: 255, b: 0 }
    }
};

var currentTheme = "white";
var currentThemeName = "White";

// ============================================
// LAYOUT
// ============================================
var LAYOUT = {
    screenW: 240,
    screenH: 320,
    margin: 10,

    headerY: 8,
    subheaderY: 30,
    dividerY: 44,

    listStartY: 54,
    rowH: 26,               // used for OS select and other menus

    footerDividerY: 290,
    footerY: 298
};

var SETTINGS_ROW_H = 22;   // compact row height for settings

LAYOUT.colLeft = LAYOUT.margin;
LAYOUT.colRight = LAYOUT.screenW / 2 + LAYOUT.margin / 2;

// ============================================
// SD CARD CONFIG SAVE/LOAD
// ============================================
var fs = null;
try { fs = require("fs"); } catch(e) {}

var CONFIG_FILE = "/sd/config.json";

function loadConfig() {
    if (!fs) return;
    try {
        if (fs.exists(CONFIG_FILE)) {
            var raw = fs.readFile(CONFIG_FILE);
            if (raw) {
                var cfg = JSON.parse(raw);
                if (cfg.settingsLED !== undefined) settingsLED = cfg.settingsLED;
                if (cfg.motionBlurEnabled !== undefined) motionBlurEnabled = cfg.motionBlurEnabled;
                if (cfg.textOutlineEnabled !== undefined) textOutlineEnabled = cfg.textOutlineEnabled;
                if (cfg.currentTheme !== undefined) currentTheme = cfg.currentTheme;
                if (cfg.customTextRGB) customTextRGB = cfg.customTextRGB;
                if (cfg.customBgRGB) customBgRGB = cfg.customBgRGB;
                if (cfg.customAccentRGB) customAccentRGB = cfg.customAccentRGB;
                refreshTheme();
            }
        }
    } catch(e) {}
}

function saveConfig() {
    if (!fs) return;
    try {
        var cfg = {
            settingsLED: settingsLED,
            motionBlurEnabled: motionBlurEnabled,
            textOutlineEnabled: textOutlineEnabled,
            currentTheme: currentTheme,
            customTextRGB: customTextRGB,
            customBgRGB: customBgRGB,
            customAccentRGB: customAccentRGB
        };
        fs.writeFile(CONFIG_FILE, JSON.stringify(cfg));
    } catch(e) {}
}

function configChanged() {
    saveConfig();
}

// ============================================
// THEME BUILDER
// ============================================
function buildTheme() {
    var textRGB = customTextRGB;
    var bgRGB = customBgRGB;
    var accentRGB = customAccentRGB;

    if (currentTheme !== "custom") {
        var preset = presetThemes[currentTheme];
        if (preset) {
            textRGB = preset.textRGB;
            bgRGB = preset.bgRGB;
            accentRGB = preset.accentRGB;
        }
    }

    var accentLuma = (accentRGB.r * 299 + accentRGB.g * 587 + accentRGB.b * 114) / 1000;
    var accentIsBright = accentLuma > 140;
    var onAccent = accentIsBright ? display.color(0, 0, 0) : display.color(255, 255, 255);
    var onAccentOutline = accentIsBright ? display.color(255, 255, 255) : display.color(0, 0, 0);

    return {
        bg: display.color(bgRGB.r, bgRGB.g, bgRGB.b),
        text: display.color(textRGB.r, textRGB.g, textRGB.b),
        accent: display.color(accentRGB.r, accentRGB.g, accentRGB.b),
        accentRGB: { r: accentRGB.r, g: accentRGB.g, b: accentRGB.b },
        onAccent: onAccent,
        onAccentOutline: onAccentOutline,
        highlight: display.color(textRGB.r, textRGB.g, textRGB.b),
        dim: 0x8C8C,
        dark: 0x4A4A,
        special: 0x4A4A8C,
        statusGood: 0x07E0,
        statusBad: 0xF800,
        statusWarn: 0xFD20
    };
}

var currentThemeObj = buildTheme();

function getTheme() { return currentThemeObj; }
function refreshTheme() { currentThemeObj = buildTheme(); }

function applyPreset(themeName, mode) {
    var color = namedColors[themeName];
    if (!color) return false;

    if (mode === "text") {
        customTextRGB.r = color.r; customTextRGB.g = color.g; customTextRGB.b = color.b;
    } else if (mode === "bg") {
        customBgRGB.r = color.r; customBgRGB.g = color.g; customBgRGB.b = color.b;
    } else if (mode === "accent") {
        customAccentRGB.r = color.r; customAccentRGB.g = color.g; customAccentRGB.b = color.b;
    }

    currentTheme = "custom";
    refreshTheme();
    configChanged();
    return true;
}

// ============================================
// RGB COLOR PICKER STATE
// ============================================
var rgbChannel = 0;
var rgbValues = { r: 255, g: 255, b: 255 };
var inRgbPicker = false;
var rgbMode = "text";

// ============================================
// MENU STATE
// ============================================
var menuState = "os_select";
var selectedItem = 0;
var currentOS = "linux";
var lastStatus = "idle";
var wifiConnected = false;
var lastClickTime = 0;
var wifiConnecting = false;
var wifiAttempts = 0;

// ============================================
// CANCEL STATE
// ============================================
var actionRunning = false;
var actionCancel = false;

// ============================================
// RIGHT-COLUMN KEYBOARD LAYOUT
// ============================================
var keyboardRows = [
    ["1","2","3","4","5","6","7","8","9","0","-","="],
    ["q","w","e","r","t","y","u","i","o","p","[","]"],
    ["a","s","d","f","g","h","j","k","l",";","'","\\"],
    ["z","x","c","v","b","n","m",",",".","/"]
];
var specialKeys = ["SHIFT", "SPACE", "BACK", "ENTER"];
var rowCount = keyboardRows.length;
var colCount = [];
for (var r = 0; r < rowCount; r++) colCount.push(keyboardRows[r].length);

// ============================================
// CUSTOM TEXT INPUT STATE
// ============================================
var customText = "";
var customMode2 = false;
var cursorRow = 0;
var cursorCol = 0;
var shiftPressed = false;

// ============================================
// OS SELECTION MENU
// ============================================
var osMenu = [
    { name: "Linux", id: "linux", active: true },
    { name: "Windows", id: "windows", active: true },
    { name: "Mac", id: "mac", active: true },
    { name: "Settings", id: "settings", active: true }
];

// ============================================
// SETTINGS MENU
// ============================================
var colorSubMenu = false;
var componentExpanded = false;
var componentSelectedIndex = -1;
var selectedMode = "";

var colorComponents = [
    { label: "Text Color", mode: "text" },
    { label: "Background", mode: "bg" },
    { label: "Accent Color", mode: "accent" }
];
var themeList = ["White", "Red", "Green", "Blue", "Custom"];

// ============================================
// PAYLOADS
// ============================================
var linuxPayloads = [
    "Type Hello","Open Terminal","Open Firefox","Lock Screen",
    "Open Files","RICK ROLL!","Type Custom","Test LED","Run linux.ds"
];
var windowsPayloads = [
    "Type Hello","Open Notepad","Open CMD","Lock PC (Win+L)",
    "MASS LAG","Open Chrome","Type Custom","RICK ROLL!","Run windows.ds"
];
var macPayloads = [
    "Type Hello","Open TextEdit","Open Terminal","Lock Screen",
    "Open Safari","Open Finder","Type Custom","RICK ROLL!","Run mac.ds"
];

function getSettingsMenu() {
    var ledStatus = settingsLED ? "ON" : "OFF";
    var blurStatus = motionBlurEnabled ? "ON" : "OFF";
    var outlineStatus = textOutlineEnabled ? "ON" : "OFF";
    return [
        { name: "LED: " + ledStatus, id: "led", active: true },
        { name: "Color Scheme", id: "color", active: true },
        { name: "Outlines: " + outlineStatus, id: "outline", active: true },
        { name: "Blur: " + blurStatus, id: "blur", active: true },
        { name: "Back", id: "back", active: true }
    ];
}

// ============================================
// WIFI FUNCTIONS
// ============================================
function connectWifi() {
    if (wifi.connected()) {
        wifiConnected = true; wifiConnecting = false;
        lastStatus = "wifi ok"; redrawCurrent(); return true;
    }
    if (wifiConnecting) return false;
    wifiConnecting = true; wifiAttempts = 0;
    lastStatus = "connecting..."; redrawCurrent();
    wifi.connect(SSID, WIFI_TIMEOUT, PASSWORD);
    return false;
}

function checkWifiProgress() {
    if (!wifiConnecting) return;
    wifiAttempts++;
    if (wifi.connected()) {
        wifiConnected = true; wifiConnecting = false;
        lastStatus = "wifi ok"; redrawCurrent(); return;
    }
    if (wifiAttempts > WIFI_TIMEOUT * 10) {
        wifiConnecting = false; wifiConnected = false;
        lastStatus = "wifi fail"; redrawCurrent(); return;
    }
    if (wifiAttempts % 5 === 0) {
        lastStatus = "connecting " + Math.floor(wifiAttempts/10) + "s";
        redrawCurrent();
    }
}

// ============================================
// HTTP FUNCTIONS
// ============================================
function send(cmd) {
    if (!wifi.connected()) {
        if (!connectWifi()) { lastStatus = "no wifi"; redrawCurrent(); return false; }
        var waitCount = 0;
        while (!wifi.connected() && waitCount < 30) { delay(100); waitCount++; }
        if (!wifi.connected()) { lastStatus = "wifi fail"; redrawCurrent(); return false; }
    }
    var url = "http://" + DONGLE_IP + ":8080/" + cmd;
    lastStatus = "sending..."; redrawCurrent();
    try {
        var res = wifi.httpFetch(url, { method: "GET" });
        if (res !== null && res !== undefined) {
            var status = res.status || 200;
            if (status >= 200 && status < 300) {
                lastStatus = "ok!"; redrawCurrent(); return true;
            } else {
                lastStatus = "fail (" + status + ")"; redrawCurrent(); return false;
            }
        } else {
            lastStatus = "no response"; redrawCurrent(); return false;
        }
    } catch (e) {
        lastStatus = "err: " + e; redrawCurrent(); return false;
    }
}

function raw(cmd) {
    var encoded = cmd.replace(/ /g, "%20");
    send("rawinput?rawCommand=" + encoded);
}

// ============================================
// CHECK CANCEL
// ============================================
function checkCancel() {
    if (actionCancel) {
        actionCancel = false; actionRunning = false;
        lastStatus = "cancelled!"; ledOff(); draw(); return true;
    }
    return false;
}

// ============================================
// LED FUNCTIONS
// ============================================
function ledRed()   { if (settingsLED) send("rawinput?rawCommand=LED%200%20100%20100%20255"); }
function ledGreen() { if (settingsLED) send("rawinput?rawCommand=LED%20100%20100%20100%20255"); }
function ledOff()   { if (settingsLED) send("rawinput?rawCommand=LED%200%200%200%200"); }
function ledFlashRed() { if (!settingsLED) return; ledRed(); delay(300); ledOff(); }
function ledSweep() {
    if (!settingsLED) { lastStatus = "LED disabled!"; draw(); return; }
    for (var h = 0; h < 256; h++) {
        if (checkCancel()) return;
        send("rawinput?rawCommand=LED%20" + h + "%20100%20100%20255");
        delay(20);
    }
    send("rawinput?rawCommand=LED%200%200%200%200");
}

// ============================================
// RIGHT-COLUMN KEYBOARD
// ============================================
function typeCustom() {
    customText = ""; cursorRow = 0; cursorCol = 0; shiftPressed = false;
    customMode2 = true; lastStatus = "typing..."; drawKeyboard();
    while (customMode2) {
        var redraw = false;
        if (keyboard.getNextPress()) {
            cursorCol++;
            if (cursorCol > colCount[cursorRow]) { cursorCol = 0; cursorRow = (cursorRow + 1) % rowCount; }
            redraw = true;
        }
        if (keyboard.getPrevPress()) {
            cursorCol--;
            if (cursorCol < 0) { cursorRow = (cursorRow - 1 + rowCount) % rowCount; cursorCol = colCount[cursorRow]; }
            redraw = true;
        }
        if (keyboard.getSelPress()) {
            var key;
            if (cursorCol === colCount[cursorRow]) key = specialKeys[cursorRow];
            else key = keyboardRows[cursorRow][cursorCol];
            if (key !== "") handleKeyPress(key);
            if (!customMode2) break;
            redraw = true;
        }
        if (keyboard.getEscPress()) {
            if (customText.length > 0) {
                raw("ENTER"); delay(100); ledFlashRed();
                lastStatus = "sent: " + customText; customMode2 = false; draw();
            } else {
                customMode2 = false; lastStatus = "cancelled"; draw();
            }
            break;
        }
        if (redraw) drawKeyboard();
        delay(20);
    }
}

function handleKeyPress(key) {
    if (key === "SHIFT") { shiftPressed = !shiftPressed; lastStatus = shiftPressed ? "SHIFT ON" : "SHIFT OFF"; drawKeyboard(); return; }
    if (key === "SPACE") { customText += " "; raw("SPACE"); lastStatus = "SPACE"; drawKeyboard(); return; }
    if (key === "BACK") { if (customText.length > 0) { customText = customText.slice(0, -1); raw("BACKSPACE"); lastStatus = "BACK"; } drawKeyboard(); return; }
    if (key === "ENTER") { raw("ENTER"); delay(100); ledFlashRed(); lastStatus = "sent: " + customText; customMode2 = false; draw(); return; }
    var char = key;
    if (shiftPressed) { char = key.toUpperCase(); shiftPressed = false; lastStatus = "SHIFT used"; }
    customText += char; raw("STRING " + char); drawKeyboard();
}

function drawKeyboard() {
    var theme = getTheme();
    var width = 240, height = 320;
    sprite.fill(theme.bg);
    sprite.setTextSize(1); sprite.setTextColor(theme.text); sprite.drawText("60% KB", 5, 2);
    sprite.setTextColor(theme.dim); sprite.drawText("ESC:Send Click:Add", 50, 2); sprite.drawText("Rotate:Move", 175, 2);
    sprite.setTextSize(1); sprite.setTextColor(theme.accent);
    var displayText = customText;
    if (displayText.length > 28) displayText = "..." + displayText.substring(displayText.length - 25);
    sprite.drawText(displayText, 5, 15);
    sprite.drawLine(5, 26, width - 5, 26, theme.dark);

    var startY = 32, cellH = 22, gap = 2;
    var cols = 12;
    var cellW = Math.floor((width - 10 - gap * (cols - 1)) / cols);
    var specialW = 30, mainW = width - specialW - 10;
    var mainCellW = Math.floor((mainW - 10 - gap * (cols - 1)) / cols);
    var mainXOffset = 5, specialXOffset = mainXOffset + mainW + 5;

    for (var r = 0; r < rowCount; r++) {
        var row = keyboardRows[r];
        var x = mainXOffset, y = startY + r * (cellH + gap);
        for (var c = 0; c < row.length; c++) {
            var key = row[c];
            var isSelected = (r === cursorRow && c === cursorCol);
            var dKey = (shiftPressed && key >= 'a' && key <= 'z') ? key.toUpperCase() : key;
            if (isSelected) { sprite.drawFillRect(x, y, mainCellW, cellH, theme.accent); sprite.setTextColor(theme.bg); }
            else { sprite.drawRect(x, y, mainCellW, cellH, theme.dim); sprite.setTextColor(theme.text); }
            sprite.setTextSize(1); sprite.drawText(dKey, x + 4, y + 5);
            x += mainCellW + gap;
        }
        var spKey = specialKeys[r];
        var isSpSel = (r === cursorRow && cursorCol === colCount[r]);
        var sx = specialXOffset, sy = y;
        if (isSpSel) { sprite.drawFillRect(sx, sy, specialW, cellH, theme.accent); sprite.setTextColor(theme.bg); }
        else { sprite.drawFillRect(sx, sy, specialW, cellH, theme.special); sprite.drawRect(sx, sy, specialW, cellH, theme.dim); sprite.setTextColor(theme.text); }
        sprite.setTextSize(1); sprite.drawText(spKey, sx + 2, sy + 5);
    }
    var totalKeys = rowCount * colCount[0] + rowCount;
    var currentPos = cursorRow * colCount[0] + cursorCol + 1;
    sprite.setTextSize(1); sprite.setTextColor(theme.dim);
    sprite.drawText("Key:" + currentPos + "/" + totalKeys, 5, height - 12);
    sprite.drawText("Len:" + customText.length, 180, height - 12);
    sprite.setTextColor(theme.statusWarn);
    sprite.drawText("Shift: " + (shiftPressed ? "ON" : "OFF"), 100, height - 12);
    sprite.setTextColor(theme.dim);
    sprite.drawText("Last: " + lastStatus, 5, height - 30);
    sprite.pushSprite();
}

// ============================================
// PAYLOAD EXECUTION
// ============================================
function executeLinuxPayload(idx) {
    if (idx===0) { raw("STRING hello"); delay(100); ledFlashRed(); }
    else if (idx===1) { raw("CTRL ALT t"); delay(100); ledFlashRed(); }
    else if (idx===2) { raw("GUI"); raw("STRING firefox"); raw("ENTER"); delay(100); ledFlashRed(); }
    else if (idx===3) { raw("CTRL ALT l"); delay(100); ledFlashRed(); }
    else if (idx===4) { raw("GUI"); raw("STRING files"); raw("ENTER"); delay(100); ledFlashRed(); }
    else if (idx===5) { raw("GUI"); raw("STRING firefox"); raw("ENTER"); delay(300); raw("STRING https://www.youtube.com/watch?v=dQw4w9WgXcQ"); delay(200); raw("ENTER"); delay(100); ledFlashRed(); }
    else if (idx===6) { typeCustom(); }
    else if (idx===7) { ledSweep(); }
    else if (idx===8) { send("runfile?filename=linux.ds"); delay(100); ledFlashRed(); }
}
function executeWindowsPayload(idx) {
    if (idx===0) { raw("STRING hello"); delay(100); ledFlashRed(); }
    else if (idx===1) { raw("GUI r"); raw("DELAY 200"); raw("STRING notepad"); raw("ENTER"); delay(100); ledFlashRed(); }
    else if (idx===2) { raw("GUI r"); raw("DELAY 200"); raw("STRING cmd"); raw("ENTER"); delay(100); ledFlashRed(); }
    else if (idx===3) { raw("GUI l"); delay(100); ledFlashRed(); }
    else if (idx===4) { for (var i=0;i<50;i++) { if (checkCancel()) return; raw("CTRL"); raw("SHIFT"); raw("GUI"); raw("b"); } delay(100); ledFlashRed(); }
    else if (idx===5) { raw("GUI r"); raw("DELAY 200"); raw("STRING chrome"); raw("ENTER"); delay(100); ledFlashRed(); }
    else if (idx===6) { typeCustom(); }
    else if (idx===7) { raw("GUI r"); raw("DELAY 200"); raw("STRING https://www.youtube.com/watch?v=dQw4w9WgXcQ"); raw("ENTER"); delay(100); ledFlashRed(); }
    else if (idx===8) { send("runfile?filename=windows.ds"); delay(100); ledFlashRed(); }
}
function executeMacPayload(idx) {
    function openApp(name) { raw("GUI SPACE"); delay(200); raw("STRING "+name); delay(200); raw("ENTER"); }
    if (idx===0) { raw("STRING hello"); delay(100); ledFlashRed(); }
    else if (idx===1) { openApp("TextEdit"); delay(100); ledFlashRed(); }
    else if (idx===2) { openApp("Terminal"); delay(100); ledFlashRed(); }
    else if (idx===3) { raw("GUI CTRL q"); delay(100); ledFlashRed(); }
    else if (idx===4) { openApp("Safari"); delay(100); ledFlashRed(); }
    else if (idx===5) { raw("GUI TAB"); raw("GUI n"); delay(100); ledFlashRed(); }
    else if (idx===6) { typeCustom(); }
    else if (idx===7) { openApp("Safari"); delay(500); raw("STRING https://www.youtube.com/watch?v=dQw4w9WgXcQ"); raw("ENTER"); delay(100); ledFlashRed(); }
    else if (idx===8) { send("runfile?filename=mac.ds"); delay(100); ledFlashRed(); }
}

// ============================================
// HELPER: draw text with outline
// ============================================
function drawTextWithOutline(text, x, y, color, size, outlineColor) {
    var savedSize = sprite.textSize, savedColor = sprite.textColor;
    sprite.setTextSize(size);
    if (textOutlineEnabled) {
        var offsets = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
        sprite.setTextColor(outlineColor || display.color(0,0,0));
        for (var i = 0; i < offsets.length; i++) sprite.drawText(text, x + offsets[i][0], y + offsets[i][1]);
    }
    sprite.setTextColor(color); sprite.drawText(text, x, y);
    sprite.setTextSize(savedSize); sprite.setTextColor(savedColor);
}

var CHAR_W = { 1:6, 2:12 };
function measureTextWidth(text, size) {
    if (typeof sprite.textWidth === "function") {
        var saved = sprite.textSize; sprite.setTextSize(size);
        var w = sprite.textWidth(text); sprite.setTextSize(saved);
        if (w) return w;
    }
    return text.length * (CHAR_W[size] || 6);
}

function makeItemRect(x0, y, size, label, padX, padY, h, maxW) {
    var w = measureTextWidth(label, size) + padX * 2;
    if (maxW !== undefined && w > maxW) w = maxW;
    return { x: x0 - padX, y: y - padY, w: w, h: h, padX: padX, padY: padY };
}

function getItemColors(theme, isSelected) {
    return isSelected ? { color: theme.accent, outline: display.color(0,0,0) } : { color: theme.text, outline: display.color(0,0,0) };
}

// ============================================
// HEADER / FOOTER (full‑width divider)
// ============================================
function drawHeader(theme, title, subtitle) {
    drawTextWithOutline(title, LAYOUT.margin, LAYOUT.headerY, theme.text, 2, display.color(0,0,0));
    if (subtitle) { sprite.setTextSize(1); sprite.setTextColor(theme.dim); sprite.drawText(subtitle, LAYOUT.margin, LAYOUT.subheaderY); }
    sprite.drawLine(0, LAYOUT.dividerY, LAYOUT.screenW, LAYOUT.dividerY, theme.dark);
}

function drawFooter(theme, hint) {
    sprite.drawLine(0, LAYOUT.footerDividerY, LAYOUT.screenW, LAYOUT.footerDividerY, theme.dark);
    sprite.setTextSize(1); sprite.setTextColor(theme.dim); sprite.drawText(hint, LAYOUT.margin, LAYOUT.footerY);
}

// ============================================
// SELECTION BAR ANIMATION
// ============================================
function getContextKey() {
    if (inRgbPicker) return "rgb";
    if (colorSubMenu) return componentExpanded ? "color_theme" : "color_component";
    return menuState;
}

var listScrollOffset = 0;

function getRowHForContext(context) {
    if (context === "settings") return SETTINGS_ROW_H;
    return LAYOUT.rowH;
}

function getVisibleRowCount() {
    var span = LAYOUT.footerDividerY - LAYOUT.listStartY;
    var rows = Math.floor(span / LAYOUT.rowH);
    return Math.max(1, rows);
}

function updateScrollOffset(context) {
    if (context !== "settings") {
        listScrollOffset = 0;
        return;
    }
    var total = getItemCount(context);
    var rowH = getRowHForContext(context);
    var span = LAYOUT.footerDividerY - LAYOUT.listStartY;
    var visible = Math.floor(span / rowH);
    if (visible < 1) visible = 1;
    if (total > visible) {
        if (selectedItem < listScrollOffset) listScrollOffset = selectedItem;
        if (selectedItem >= listScrollOffset + visible) listScrollOffset = selectedItem - visible + 1;
        var maxOffset = total - visible;
        if (listScrollOffset > maxOffset) listScrollOffset = maxOffset;
        if (listScrollOffset < 0) listScrollOffset = 0;
    } else {
        listScrollOffset = 0;
    }
}

function getSelectionRect(context, index) {
    if (context === "os_select") {
        var col = (index % 2 === 0) ? LAYOUT.colLeft : LAYOUT.colRight;
        var rowTop = LAYOUT.listStartY + Math.floor(index / 2) * LAYOUT.rowH;
        var label = getItemLabel(context, index);
        var maxW = (LAYOUT.screenW / 2) - LAYOUT.margin - 8;
        return makeItemRect(col, rowTop, 2, label, 6, 4, 22, maxW);
    }

    // Settings – compact layout
    if (context === "settings") {
        var rowH = SETTINGS_ROW_H;
        var rowTop = LAYOUT.listStartY + (index - listScrollOffset) * rowH;
        var label = getItemLabel(context, index);
        var maxW = LAYOUT.screenW - LAYOUT.margin * 2 - 8;
        return makeItemRect(LAYOUT.margin, rowTop, 2, label, 4, 2, 18, maxW);
    }

    if (context === "color_component") {
        var rowTop = LAYOUT.listStartY + index * LAYOUT.rowH;
        var label = getItemLabel(context, index);
        var maxW = LAYOUT.screenW - LAYOUT.margin * 2 - 8;
        return makeItemRect(LAYOUT.colLeft, rowTop, 2, label, 6, 4, 22, maxW);
    }
    if (context === "color_theme") {
        var col = (index % 2 === 0) ? LAYOUT.colLeft : LAYOUT.colRight;
        var rowTop = LAYOUT.listStartY + Math.floor(index / 2) * LAYOUT.rowH;
        var label = getItemLabel(context, index);
        var maxW = (LAYOUT.screenW / 2) - LAYOUT.margin - 8;
        return makeItemRect(col, rowTop, 2, label, 6, 4, 22, maxW);
    }

    // Payload select (2‑column)
    if (context === "payload_select") {
        var payloadRowH = 24;
        var payloads = (currentOS === "linux") ? linuxPayloads : (currentOS === "windows") ? windowsPayloads : macPayloads;
        var total = payloads.length;
        var half = Math.ceil(total / 2);
        var col = (index < half) ? LAYOUT.colLeft : LAYOUT.colRight;
        var rowIdx = (index < half) ? index : index - half;
        var rowTop = LAYOUT.listStartY + rowIdx * payloadRowH;
        var maxW = (LAYOUT.screenW / 2) - LAYOUT.margin - 8;
        var label = getItemLabel(context, index);
        return makeItemRect(col, rowTop, 1, label, 6, 7, 22, maxW);
    }

    return null;
}

function getItemCount(context) {
    if (context === "os_select") return 4;
    if (context === "settings") return getSettingsMenu().length;
    if (context === "color_component") return colorComponents.length;
    if (context === "color_theme") return themeList.length;
    if (context === "payload_select") {
        var payloads = (currentOS === "linux") ? linuxPayloads : (currentOS === "windows") ? windowsPayloads : macPayloads;
        return payloads.length;
    }
    return 0;
}
function getItemLabel(context, index) {
    if (context === "os_select") return ["Linux","Windows","Mac","Settings"][index];
    if (context === "settings") return getSettingsMenu()[index].name;
    if (context === "color_component") return colorComponents[index].label;
    if (context === "color_theme") return themeList[index];
    if (context === "payload_select") {
        var payloads = (currentOS === "linux") ? linuxPayloads : (currentOS === "windows") ? windowsPayloads : macPayloads;
        return payloads[index];
    }
    return "";
}
function getItemTextSize(context) { return (context === "payload_select") ? 1 : 2; }

function rectsOverlap(a, b) { return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y); }
function unionRect(a, b) {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.max(a.x + a.w, b.x + b.w) - Math.min(a.x, b.x), h: Math.max(a.y + a.h, b.y + b.h) - Math.min(a.y, b.y) };
}

var selBar = { x:0,y:0,w:0,h:0, fromX:0,fromY:0,fromW:0,fromH:0, toX:0,toY:0,toW:0,toH:0, startTime:0, duration:150, context:"", index:-1, ready:false, trail:[], lastTrailTime:0 };
var selBarAnimating = false;
var BAR_RADIUS = 5;
var BLUR_TRAIL_LEN = 8;
var BLUR_TRAIL_SAMPLE_MS = 9;

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function dimColor(rgb, factor) { return display.color(Math.floor(rgb.r*factor), Math.floor(rgb.g*factor), Math.floor(rgb.b*factor)); }

function updateSelectionAnim() {
    var context = getContextKey();
    var target = getSelectionRect(context, selectedItem);
    if (!target) { selBarAnimating = false; return null; }
    if (!selBar.ready || context !== selBar.context) {
        selBar.x = target.x; selBar.y = target.y; selBar.w = target.w; selBar.h = target.h;
        selBar.fromX = target.x; selBar.fromY = target.y; selBar.fromW = target.w; selBar.fromH = target.h;
        selBar.toX = target.x; selBar.toY = target.y; selBar.toW = target.w; selBar.toH = target.h;
        selBar.startTime = Date.now(); selBar.context = context; selBar.index = selectedItem;
        selBar.ready = true; selBar.trail = []; selBar.lastTrailTime = 0; selBarAnimating = false;
        return { x: selBar.x, y: selBar.y, w: selBar.w, h: selBar.h };
    }
    if (selectedItem !== selBar.index) {
        selBar.fromX = selBar.x; selBar.fromY = selBar.y; selBar.fromW = selBar.w; selBar.fromH = selBar.h;
        selBar.toX = target.x; selBar.toY = target.y; selBar.toW = target.w; selBar.toH = target.h;
        selBar.startTime = Date.now(); selBar.index = selectedItem; selBar.trail = []; selBar.lastTrailTime = 0;
    }
    var nowMs = Date.now();
    if (motionBlurEnabled) {
        if (nowMs - selBar.lastTrailTime >= BLUR_TRAIL_SAMPLE_MS) {
            selBar.trail.unshift({ x: selBar.x, y: selBar.y, w: selBar.w, h: selBar.h });
            if (selBar.trail.length > BLUR_TRAIL_LEN) selBar.trail.length = BLUR_TRAIL_LEN;
            selBar.lastTrailTime = nowMs;
        }
    } else selBar.trail = [];
    var elapsed = Date.now() - selBar.startTime;
    var t = Math.min(1, elapsed / selBar.duration);
    var e = easeOutCubic(t);
    selBar.x = selBar.fromX + (selBar.toX - selBar.fromX) * e;
    selBar.y = selBar.fromY + (selBar.toY - selBar.fromY) * e;
    selBar.w = selBar.fromW + (selBar.toW - selBar.fromW) * e;
    selBar.h = selBar.fromH + (selBar.toH - selBar.fromH) * e;
    selBarAnimating = t < 1;
    if (!selBarAnimating) selBar.trail = [];
    return { x: selBar.x, y: selBar.y, w: selBar.w, h: selBar.h };
}

function drawRoundedRectOutline(x, y, w, h, radius, color) {
    if (typeof sprite.drawRoundRect === "function") { sprite.drawRoundRect(x, y, w, h, radius, color); return; }
    var r = Math.max(0, Math.min(radius, Math.floor(Math.min(w, h)/2)));
    if (r <= 0) { sprite.drawRect(x, y, w, h, color); return; }
    sprite.drawLine(x+r, y, x+w-r, y, color);
    sprite.drawLine(x+r, y+h, x+w-r, y+h, color);
    sprite.drawLine(x, y+r, x, y+h-r, color);
    sprite.drawLine(x+w, y+r, x+w, y+h-r, color);
    sprite.drawLine(x, y+r, x+r, y, color);
    sprite.drawLine(x+w-r, y, x+w, y+r, color);
    sprite.drawLine(x, y+h-r, x+r, y+h, color);
    sprite.drawLine(x+w-r, y+h, x+w, y+h-r, color);
}
function drawSelectionBar(theme, rect, color, radius) {
    if (!rect) return;
    var x = Math.round(rect.x), y = Math.round(rect.y), w = Math.round(rect.w), h = Math.round(rect.h);
    var r = (radius === undefined) ? BAR_RADIUS : radius;
    var c = color || theme.accent;
    drawRoundedRectOutline(x, y, w, h, r, c);
    drawRoundedRectOutline(x+1, y+1, w-2, h-2, Math.max(0, r-1), c);
}

function drawAnimTick() {
    var context = getContextKey();
    if (context === "rgb") return;
    updateScrollOffset(context);
    var theme = getTheme();
    var prevRect = { x: selBar.x, y: selBar.y, w: selBar.w, h: selBar.h };
    var prevTrail = selBar.trail.slice();
    var rect = updateSelectionAnim();
    if (!rect) return;
    var dirty = unionRect(prevRect, rect);
    for (var d=0; d<prevTrail.length; d++) dirty = unionRect(dirty, prevTrail[d]);
    for (var d2=0; d2<selBar.trail.length; d2++) dirty = unionRect(dirty, selBar.trail[d2]);
    var pad = 4;
    dirty.x -= pad; dirty.y -= pad; dirty.w += pad*2; dirty.h += pad*2;
    sprite.drawFillRect(Math.round(dirty.x), Math.round(dirty.y), Math.round(dirty.w), Math.round(dirty.h), theme.bg);
    if (dirty.y <= LAYOUT.dividerY && dirty.y + dirty.h >= LAYOUT.dividerY) {
        sprite.drawLine(0, LAYOUT.dividerY, LAYOUT.screenW, LAYOUT.dividerY, theme.dark);
    }
    if (motionBlurEnabled && selBar.trail.length > 0) {
        for (var ti = selBar.trail.length-1; ti >= 0; ti--) {
            var fade = 0.85 - ti*0.09; if (fade < 0.12) fade = 0.12;
            drawSelectionBar(theme, selBar.trail[ti], dimColor(theme.accentRGB, fade), BAR_RADIUS);
        }
    }
    drawSelectionBar(theme, rect, theme.accent, BAR_RADIUS);
    var count = getItemCount(context);
    for (var i=0; i<count; i++) {
        var itemRect = getSelectionRect(context, i);
        if (!itemRect || !rectsOverlap(itemRect, dirty)) continue;
        var label = getItemLabel(context, i);
        var isSelected = (i === selectedItem);
        var colors = getItemColors(theme, isSelected);
        var size = getItemTextSize(context);
        drawTextWithOutline(label, itemRect.x + itemRect.padX, itemRect.y + itemRect.padY, colors.color, size, colors.outline);
    }
    sprite.pushSprite();
}

// ============================================
// SETTINGS EXECUTION
// ============================================
function executeSettings(idx) {
    if (inRgbPicker) return;
    if (colorSubMenu) {
        if (componentExpanded) {
            var presetNames = ["white","red","green","blue","custom"];
            if (idx >= 0 && idx < presetNames.length) {
                var presetName = presetNames[idx];
                var mode = selectedMode;
                if (presetName === "custom") {
                    var targetRGB = (mode==="text") ? customTextRGB : (mode==="bg") ? customBgRGB : customAccentRGB;
                    rgbMode = mode; rgbValues.r = targetRGB.r; rgbValues.g = targetRGB.g; rgbValues.b = targetRGB.b; activeRGB = targetRGB;
                    inRgbPicker = true; rgbChannel = 0;
                    lastStatus = "Adjust " + (mode==="text"?"Text Color":mode==="bg"?"Background":"Accent Color");
                    draw(); return;
                } else {
                    if (applyPreset(presetName, mode)) {
                        var modeLabel = (mode==="text")?"Text":(mode==="bg")?"Background":"Accent";
                        lastStatus = modeLabel + ": " + presetName.charAt(0).toUpperCase()+presetName.slice(1);
                        refreshTheme(); draw(); return;
                    }
                }
            }
            return;
        }
        if (idx >= 0 && idx < colorComponents.length) {
            componentSelectedIndex = idx; selectedMode = colorComponents[idx].mode; componentExpanded = true; selectedItem = 0;
            lastStatus = "Select preset for " + colorComponents[idx].label;
            draw(); return;
        }
        return;
    }
    var items = getSettingsMenu();
    if (idx < 0 || idx >= items.length) return;
    var id = items[idx].id;
    if (id === "led") {
        settingsLED = !settingsLED;
        lastStatus = settingsLED ? "LED ON" : "LED OFF";
        configChanged();
        draw(); delay(500);
        if (!settingsLED) ledOff(); else { ledGreen(); delay(200); ledOff(); }
        draw();
    }
    else if (id === "color") { colorSubMenu = true; selectedItem = 0; componentExpanded = false; selectedMode = "text"; lastStatus = "Select component to customize"; draw(); }
    else if (id === "outline") { textOutlineEnabled = !textOutlineEnabled; lastStatus = textOutlineEnabled ? "Outlines ON" : "Outlines OFF"; configChanged(); draw(); }
    else if (id === "blur") { motionBlurEnabled = !motionBlurEnabled; selBar.trail = []; selBar.lastTrailTime = 0; lastStatus = motionBlurEnabled ? "Blur ON" : "Blur OFF"; configChanged(); draw(); }
    else if (id === "back") { menuState = "os_select"; selectedItem = 0; draw(); }
}

// ============================================
// MAIN EXECUTION
// ============================================
function runAction() {
    var currentTime = Date.now();
    if (currentTime - lastClickTime < 300) return;
    lastClickTime = currentTime;
    if (actionRunning) { actionCancel = true; lastStatus = "cancelling..."; draw(); return; }
    if (menuState === "settings") { executeSettings(selectedItem); return; }
    if (menuState === "os_select") {
        var sel = osMenu[selectedItem];
        if (sel.id === "settings") { menuState = "settings"; selectedItem = 0; colorSubMenu = false; inRgbPicker = false; componentExpanded = false; draw(); return; }
        if (sel.active) { currentOS = sel.id; menuState = "payload_select"; selectedItem = 0; draw(); }
        else { lastStatus = "coming soon!"; draw(); delay(800); lastStatus = "idle"; draw(); }
        return;
    }
    if (menuState === "payload_select") {
        if (wifiConnecting) {
            lastStatus = "waiting for wifi..."; draw();
            var wc=0;
            while (wifiConnecting && wc<30) { delay(100); wc++; if (wifi.connected()) { wifiConnected=true; wifiConnecting=false; lastStatus="wifi ok"; draw(); } }
        }
        actionRunning = true; actionCancel = false; lastStatus = "running..."; draw();
        if (currentOS === "linux") executeLinuxPayload(selectedItem);
        else if (currentOS === "windows") executeWindowsPayload(selectedItem);
        else if (currentOS === "mac") executeMacPayload(selectedItem);
        if (!actionCancel) { actionRunning = false; if (lastStatus !== "cancelled!") { lastStatus = "done!"; draw(); } }
    }
}

// ============================================
// DRAW MAIN MENU (version label removed)
// ============================================
function draw() {
    var theme = getTheme();
    updateScrollOffset(getContextKey());
    var selRect = updateSelectionAnim();
    sprite.fill(theme.bg);

    if (inRgbPicker) {
        var modeLabel = (rgbMode==="text")?"TEXT":(rgbMode==="bg")?"BG":"ACCENT";
        drawHeader(theme, modeLabel + " COLOR", "R:"+rgbValues.r+" G:"+rgbValues.g+" B:"+rgbValues.b);
        sprite.setTextSize(1); sprite.setTextColor(theme.dim);
        sprite.drawText("ESC:Save Click:Chan", LAYOUT.margin, LAYOUT.dividerY + 8);
        var previewY = LAYOUT.dividerY + 20;
        var previewColor = display.color(rgbValues.r, rgbValues.g, rgbValues.b);
        sprite.drawFillRect(LAYOUT.margin, previewY, LAYOUT.screenW - LAYOUT.margin*2, 20, previewColor);
        sprite.drawRect(LAYOUT.margin, previewY, LAYOUT.screenW - LAYOUT.margin*2, 20, theme.text);
        var sliderY = previewY + 30, sliderW = LAYOUT.screenW - LAYOUT.margin*2 - 20, sliderX = LAYOUT.margin + 20, sliderH = 8, sliderGap = 18;
        var channels = [
            { label:"R", val:rgbValues.r, color:display.color(255,0,0) },
            { label:"G", val:rgbValues.g, color:display.color(0,255,0) },
            { label:"B", val:rgbValues.b, color:display.color(0,0,255) }
        ];
        for (var i=0; i<3; i++) {
            var ch = channels[i], y = sliderY + i*sliderGap;
            drawTextWithOutline(ch.label, LAYOUT.margin, y, ch.color, 1, display.color(0,0,0));
            sprite.drawRect(sliderX, y, sliderW, sliderH, theme.dim);
            var pos = Math.floor((ch.val / 255) * sliderW);
            sprite.drawFillRect(sliderX, y, pos, sliderH, ch.color);
            if (rgbChannel === i) sprite.drawRect(sliderX-2, y-2, sliderW+4, sliderH+4, theme.text);
        }
        sprite.pushSprite(); return;
    }

    if (colorSubMenu) {
        drawHeader(theme, "COLOR SCHEME", null);
        drawSelectionBar(theme, selRect);
        if (!componentExpanded) {
            for (var i=0; i<colorComponents.length; i++) {
                var rect = getSelectionRect("color_component", i);
                var colors = getItemColors(theme, i===selectedItem);
                drawTextWithOutline(colorComponents[i].label, rect.x + rect.padX, rect.y + rect.padY, colors.color, 2, colors.outline);
            }
        } else {
            sprite.setTextSize(1); sprite.setTextColor(theme.dim);
            sprite.drawText("Customizing: " + (selectedMode==="text"?"Text Color":selectedMode==="bg"?"Background":"Accent Color"), LAYOUT.margin, LAYOUT.subheaderY);
            for (var i=0; i<themeList.length; i++) {
                var rect = getSelectionRect("color_theme", i);
                var colors = getItemColors(theme, i===selectedItem);
                drawTextWithOutline(themeList[i], rect.x + rect.padX, rect.y + rect.padY, colors.color, 2, colors.outline);
            }
        }
        drawFooter(theme, "ESC = Back");
        sprite.pushSprite(); return;
    }

    if (menuState === "os_select") {
        drawHeader(theme, "SELECT OS", "Target Computer OS:");
        drawSelectionBar(theme, selRect);
        var labels = ["Linux","Windows","Mac","Settings"];
        for (var i=0; i<4; i++) {
            var rect = getSelectionRect("os_select", i);
            var colors = getItemColors(theme, i===selectedItem);
            drawTextWithOutline(labels[i], rect.x + rect.padX, rect.y + rect.padY, colors.color, 2, colors.outline);
        }
        drawFooter(theme, "Select: Click | Navigate: Rotate");
        sprite.setTextColor(theme.accent);
        sprite.drawText("[Linux / Windows / Mac | " + (settingsLED?"LED: ON":"LED: OFF") + "]", LAYOUT.margin, LAYOUT.footerY - 16);
        sprite.pushSprite(); return;
    }

    // Settings menu – compact rows
    if (menuState === "settings") {
        var items = getSettingsMenu();
        drawHeader(theme, "SETTINGS", "status: " + lastStatus);
        drawSelectionBar(theme, selRect);
        var rowH = SETTINGS_ROW_H;
        var visible = Math.floor((LAYOUT.footerDividerY - LAYOUT.listStartY) / rowH);
        var lastVisible = Math.min(items.length, listScrollOffset + visible);
        for (var i = listScrollOffset; i < lastVisible; i++) {
            var rect = getSelectionRect("settings", i);
            var colors = getItemColors(theme, i === selectedItem);
            drawTextWithOutline(items[i].name, rect.x + rect.padX, rect.y + rect.padY, colors.color, 2, colors.outline);
        }
        sprite.setTextSize(1); sprite.setTextColor(theme.dim);
        if (listScrollOffset > 0) sprite.drawText("^ more", LAYOUT.screenW/2 - 18, LAYOUT.dividerY + 3);
        if (lastVisible < items.length) sprite.drawText("v more", LAYOUT.screenW/2 - 18, LAYOUT.footerDividerY - 13);
        drawFooter(theme, "Select: Click | Navigate: Rotate");
        sprite.pushSprite(); return;
    }

    // Payload selection – 2 columns
    if (menuState === "payload_select") {
        var osName = currentOS.charAt(0).toUpperCase() + currentOS.slice(1);
        var statusText = "status: " + lastStatus;
        if (wifiConnected) statusText += " [WiFi]";
        drawHeader(theme, osName, null);
        drawSelectionBar(theme, selRect);
        sprite.setTextSize(1);
        if (actionRunning) sprite.setTextColor(theme.statusWarn);
        else if (lastStatus.indexOf("connecting")>=0 || lastStatus.indexOf("waiting")>=0) sprite.setTextColor(theme.statusBad);
        else if (lastStatus==="wifi fail"||lastStatus==="no wifi!") sprite.setTextColor(theme.statusBad);
        else if (lastStatus==="cancelled!") sprite.setTextColor(theme.statusWarn);
        else sprite.setTextColor(theme.dim);
        sprite.drawText(statusText, LAYOUT.margin, LAYOUT.subheaderY);
        var payloads = (currentOS==="linux")?linuxPayloads:(currentOS==="windows")?windowsPayloads:macPayloads;
        var total = payloads.length;
        var half = Math.ceil(total/2);
        for (var i = 0; i < total; i++) {
            var col = (i < half) ? LAYOUT.colLeft : LAYOUT.colRight;
            var idx = (i < half) ? i : i - half;
            var y = LAYOUT.listStartY + idx * 24;
            var label = payloads[i];
            var colors = getItemColors(theme, i === selectedItem);
            drawTextWithOutline(label, col, y, colors.color, 1, colors.outline);
        }
        drawFooter(theme, "Click again to cancel");
        sprite.pushSprite(); return;
    }
    sprite.pushSprite();
}

function redrawCurrent() {
    if (customMode2) drawKeyboard(); else draw();
}

// ============================================
// MAIN PROGRAM
// ============================================
loadConfig();
selectedItem = 0;
menuState = "os_select";
lastStatus = "starting...";
draw();

// ============================================
// MAIN LOOP
// ============================================
while (true) {
    checkWifiProgress();
    if (inRgbPicker) {
        if (keyboard.getNextPress()) {
            if (rgbChannel===0) rgbValues.r = Math.min(255, rgbValues.r+5);
            else if (rgbChannel===1) rgbValues.g = Math.min(255, rgbValues.g+5);
            else rgbValues.b = Math.min(255, rgbValues.b+5);
            if (activeRGB) { activeRGB.r=rgbValues.r; activeRGB.g=rgbValues.g; activeRGB.b=rgbValues.b; }
            refreshTheme(); draw();
        }
        if (keyboard.getPrevPress()) {
            if (rgbChannel===0) rgbValues.r = Math.max(0, rgbValues.r-5);
            else if (rgbChannel===1) rgbValues.g = Math.max(0, rgbValues.g-5);
            else rgbValues.b = Math.max(0, rgbValues.b-5);
            if (activeRGB) { activeRGB.r=rgbValues.r; activeRGB.g=rgbValues.g; activeRGB.b=rgbValues.b; }
            refreshTheme(); draw();
        }
        if (keyboard.getSelPress()) { rgbChannel = (rgbChannel+1)%3; draw(); }
        if (keyboard.getEscPress()) {
            inRgbPicker=false; colorSubMenu=false; currentTheme="custom"; lastStatus="Custom saved!";
            refreshTheme(); configChanged(); draw();
        }
        delay(10); continue;
    }
    if (colorSubMenu) {
        if (!componentExpanded) {
            if (keyboard.getNextPress()) { selectedItem = (selectedItem+1) % colorComponents.length; draw(); }
            if (keyboard.getPrevPress()) { selectedItem = (selectedItem-1+colorComponents.length) % colorComponents.length; draw(); }
            if (keyboard.getSelPress()) { componentSelectedIndex=selectedItem; selectedMode=colorComponents[selectedItem].mode; componentExpanded=true; selectedItem=0; draw(); }
        } else {
            if (keyboard.getNextPress()) { selectedItem = (selectedItem+1) % themeList.length; draw(); }
            if (keyboard.getPrevPress()) { selectedItem = (selectedItem-1+themeList.length) % themeList.length; draw(); }
            if (keyboard.getSelPress()) runAction();
        }
        if (keyboard.getEscPress()) {
            if (componentExpanded) { componentExpanded=false; selectedItem=componentSelectedIndex; draw(); }
            else { colorSubMenu=false; selectedItem=0; draw(); }
        }
        if (selBarAnimating) { drawAnimTick(); delay(2); continue; }
        delay(10); continue;
    }
    if (!customMode2) {
        if (keyboard.getNextPress()) {
            if (menuState==="os_select") { selectedItem=(selectedItem+1)%4; draw(); }
            else if (menuState==="settings") { var items=getSettingsMenu(); selectedItem=(selectedItem+1)%items.length; draw(); }
            else if (menuState==="payload_select") { var p=(currentOS==="linux")?linuxPayloads:(currentOS==="windows")?windowsPayloads:macPayloads; selectedItem=(selectedItem+1)%p.length; draw(); }
        }
        if (keyboard.getPrevPress()) {
            if (menuState==="os_select") { selectedItem=(selectedItem-1+4)%4; draw(); }
            else if (menuState==="settings") { var items=getSettingsMenu(); selectedItem=(selectedItem-1+items.length)%items.length; draw(); }
            else if (menuState==="payload_select") { var p=(currentOS==="linux")?linuxPayloads:(currentOS==="windows")?windowsPayloads:macPayloads; selectedItem=(selectedItem-1+p.length)%p.length; draw(); }
        }
        if (keyboard.getSelPress()) runAction();
        if (keyboard.getEscPress()) {
            if (menuState==="settings"||menuState==="payload_select") { menuState="os_select"; selectedItem=0; draw(); }
        }
        if (selBarAnimating) { drawAnimTick(); delay(2); continue; }
    }
    delay(10);
}
