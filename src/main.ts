import {App, debounce, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, requestUrl, Setting} from 'obsidian';

// --- Interfaces ---
interface ICodeStatsPluginSettings {
    apiKey: string;
}

// --- Constants ---
const DEFAULT_SETTINGS: Readonly<ICodeStatsPluginSettings> = {
    apiKey: "",
};

// Modifier/non-typing keys to ignore
const IGNORED_KEYS: ReadonlySet<string> = new Set([
    "Meta", "Alt", "Shift", "Control", "CapsLock", "Tab", "Escape",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Home", "End", "PageUp", "PageDown",
    "Insert", "Delete", "ContextMenu", "ScrollLock", "Pause", "NumLock",
    "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"
]);

// --- API Key Modal ---
class ApiKeyModal extends Modal {
    constructor(app: App, private plugin: CodeStatsPlugin) {
        super(app);
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();
        contentEl.createEl('h2', {text: 'Enter Code::Stats API Key'});

        const settings = {
            apiKey: this.plugin.settings.apiKey
        };

        new Setting(contentEl)
            .setName('API Key')
            .setDesc('Get your API key from your Code::Stats profile page.')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(settings.apiKey)
                .onChange(async (value) => {
                    settings.apiKey = value.trim(); // Update the local state for saving
                }));

        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Save')
                .setCta()
                .onClick(async () => {
                    if (settings.apiKey) {
                        await this.plugin.saveSettings(settings);
                        new Notice('Code::Stats API Key saved.');
                        this.close();
                    } else {
                        new Notice('API Key cannot be empty.');
                    }
                }));
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

// --- Settings Tab ---
class CodeStatsSettingTab extends PluginSettingTab {
    constructor(app: App, private plugin: CodeStatsPlugin) {
        super(app, plugin);
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        containerEl.createEl('h2', {text: 'Code::Stats Settings'});

        const settings = {
            apiKey: this.plugin.settings.apiKey
        }

        new Setting(containerEl)
            .setName('Code::stats API key')
            .setDesc('It can be found or created on https://codestats.net/my/machines page')
            .addText(text => text
                .setPlaceholder('Enter your API key')
                .setValue(settings.apiKey)
                .onChange(debounce(async (value) => {
                    settings.apiKey = value.trim();
                    await this.plugin.saveSettings(settings);
                }, 600)));
    }
}

// --- Main Plugin ---
export default class CodeStatsPlugin extends Plugin {
    public settings: ICodeStatsPluginSettings;

    private pulseIntervalId: number | null = null;
    private xpCounter: number = 0;
    private apiKeyModal: ApiKeyModal;
    private statusBarItemEl: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new CodeStatsSettingTab(this.app, this));

        this.apiKeyModal = new ApiKeyModal(this.app, this);
        this.addCommand({
            id: 'codestats-open-key-modal',
            name: 'Code::Stats: Enter API key',
            callback: () => {
                this.apiKeyModal.open();
            }
        });


        // Register event listener
        this.registerDomEvent(document, 'keyup', this.handleKeyPress);

        // Check API key on load and potentially prompt
        if (!this.settings.apiKey) {
            new Notice("Code::Stats API Key needed. Please configure it in settings or use the command.");
            return;
        }

        // Setup the interval timer
        this.resetInterval();
    }

    onunload() {
        // Send any remaining XP before unloading
        if (this.xpCounter > 0 && this.settings.apiKey) {
            void this.sendPulse();
        }
        // Clear the interval timer if it exists
        if (this.pulseIntervalId !== null) {
            window.clearInterval(this.pulseIntervalId);
            this.pulseIntervalId = null;
        }
    }

    // --- Core Logic ---
    private handleKeyPress = (evt: KeyboardEvent): void => {
        if (evt.ctrlKey || evt.metaKey || evt.altKey || evt.shiftKey) {
            return; // Ignore if any modifier keys are pressed
        }
        if (IGNORED_KEYS.has(evt.key)) {
            return; // Ignore modifier keys and non-typing keys
        }

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const editor = view?.editor

        if (!editor || !editor.hasFocus() || !editor.getCursor()) {
            return; // Ignore if the editor doesn't have focus
        }

        // Each key press is worth 1 XP
        this.xpCounter += 1;
    }

    // --- Settings Management ---
    private async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    public saveSettings = async (settings: typeof this.settings) => {
        await this.saveData(settings);
        this.resetInterval();
    }

    // --- API Interaction ---
    private sendPulse = async () => {
        if (this.xpCounter === 0) {
            return; // No XP accumulated
        }
        if (!this.settings.apiKey) {
            // We don't open the modal automatically on interval, only if manually triggered or on load.
            // User should use settings or command if key is missing during normal operation.
            return;
        }

        const xpToSend = this.xpCounter;
        this.xpCounter = 0; // Reset counter immediately

        const url = 'https://codestats.net/api/my/pulses';
        const payload = {
            coded_at: this.getISOTimestamp(),
            xps: [{
                language: 'Markdown',
                xp: xpToSend
            }]
        };

        try {
            const response = await requestUrl({
                url: url,
                method: 'POST',
                headers: {
                    'X-API-Token': this.settings.apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload),
                throw: false // Handle status codes manually
            });

            if (response.status >= 300) {
                console.error(`Code::Stats Pulse Error: ${response.status}. Response: ${response.text}`);
                if (response.status === 401) { // Unauthorized
                    new Notice("Code::Stats: Invalid API Key. Please update it in settings.");
                } else {
                    new Notice(`Code::Stats Pulse Error: ${response.status}`);
                }
                // Re-add failed XP
                this.xpCounter += xpToSend;
            } else {
                console.log(`Code::Stats Pulse Success: ${response.status}. Response: ${response.text}`);
            }
        } catch (error) {
            console.error("Code::Stats Pulse Network Error:", error);
            new Notice("Code::Stats: Network error during pulse. Check console.");
            // Re-add failed XP on network errors
            this.xpCounter += xpToSend;
        } finally {
            this.updateStatusBar();
        }
    }

    // --- Interval Management ---
    private resetInterval = () => {
        // Clear existing interval if it's set
        if (this.pulseIntervalId !== null) {
            window.clearInterval(this.pulseIntervalId);
            this.pulseIntervalId = null;
        }

        // Set new interval based on settings
        const intervalMillis = 10 * 1000; // 10 seconds

        this.pulseIntervalId = window.setInterval(this.sendPulse, intervalMillis);

        // Register the interval with Obsidian for auto-cleanup on unload
        this.registerInterval(this.pulseIntervalId);

        // Update status bar
        this.updateStatusBar();
    }

    private getISOTimestamp = (): string => {
        const date = new Date();

        const offset: number = -date.getTimezoneOffset();
        const prefix: string = offset >= 0 ? "+" : "-";

        function pad(num: number): string {
            const norm: number = Math.abs(Math.floor(num));
            return (norm < 10 ? "0" : "") + norm;
        }

        return (
            date.getFullYear() +
            "-" +
            pad(date.getMonth() + 1) +
            "-" +
            pad(date.getDate()) +
            "T" +
            pad(date.getHours()) +
            ":" +
            pad(date.getMinutes()) +
            ":" +
            pad(date.getSeconds()) +
            prefix +
            pad(offset / 60) +
            pad(offset % 60)
        );
    }

    // --- UI Updates ---
    public updateStatusBar = () => { // Made public so Modal/Settings can call it
        if (!this.statusBarItemEl) {
            this.statusBarItemEl = this.addStatusBarItem();
        }

        let text: string;
        let title: string;
        if (!this.settings.apiKey) {
            text = 'C:S [!]';
            title = 'Code::Stats: API Key needed';
        } else {
            text = 'C:S'; // Idle / OK state
            title = 'Code::Stats: Connected';
        }

        this.statusBarItemEl.setText(text);
        this.statusBarItemEl.setAttribute("aria-label", title); // Tooltip
        this.statusBarItemEl.setAttribute("title", title);      // Tooltip fallback
    }
}
