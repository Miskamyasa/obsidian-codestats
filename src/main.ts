import {App, Modal, Plugin, PluginSettingTab, Setting} from 'obsidian';


interface IPluginSettings {
    API_KEY: string;
    API_URL: string;
}

const DEFAULT_SETTINGS: IPluginSettings = {
    API_KEY: "",
    API_URL: "https://codestats.net/api",
}

export default class CodeStatsPlugin extends Plugin {
    settings: IPluginSettings;
    counter = 0;

    modal: Modal | null = null;

    async onload() {
        await this.loadSettings();

        this.modal = new ApiKeyModal(this.app, this);

        this.addCommand({
            id: 'open-modal',
            name: 'Enter Code::Stats API key',
            callback: () => {
                this.modal?.open();
            }
        });

        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('C::S');

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new SampleSettingTab(this.app, this));

        this.registerDomEvent(document, 'keyup', (evt) => {
            if (["Meta", "Alt", "Shift", "Control", "CapsLock"].includes(evt.key) || evt.key.indexOf("Arrow") !== -1) {
                return;
            }
            this.counter += 1;
        });
    
        this.registerInterval(window.setInterval(() => {
            if (this.counter > 0) {
                void this.updateStats();
            }
        },  30000));
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async updateStats() {
        if (!this.settings.API_KEY) {
            this.modal?.open();
            return;
        }
        void fetch(this.settings.API_URL + "/my/pulses", {
            method: 'POST',
            headers: {
                'X-API-Token': this.settings.API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                coded_at: new Date(),
                xps: [
                    {
                        language: 'Markdown',
                        xp: this.counter
                    }
                ]
            })
        }).finally(() => {
            this.counter = 0;
        })
    }

    onunload() {
        void this.updateStats();
    }
}

class ApiKeyModal extends Modal {
    private opened = false;

    plugin: CodeStatsPlugin;

    constructor(app: App, plugin: CodeStatsPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        if (this.opened) {
            return;
        }
        this.opened = true;
        const {contentEl} = this;
        contentEl.classList.add('codestats-modal');
        contentEl.createEl('p', {text: 'Enter Code::Stats API key'});
        const input = contentEl.createEl('input', {
            type: 'text',
            placeholder: 'Enter your API key here',
            value: this.plugin.settings.API_KEY
        })
        contentEl.createEl('button', {text: 'Save'}).addEventListener('click', () => {
            this.plugin.settings.API_KEY = input.value;
            this.plugin.saveSettings();
            this.close();
        })
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
        this.opened = false;
    }
}

class SampleSettingTab extends PluginSettingTab {
    plugin: CodeStatsPlugin;

    constructor(app: App, plugin: CodeStatsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;

        containerEl.empty();
        
        containerEl.createEl('h2', {text: 'Code::Stats plugin settings'});

        new Setting(containerEl)
            .setName('Code::stats API key')
            .setDesc('It can be found or created on https://codestats.net/my/machines page')
            .addText(text => text
                .setPlaceholder('Enter your API key here')
                .setValue(this.plugin.settings.API_KEY)
                .onChange(async (value) => {
                    this.plugin.settings.API_KEY = value;
                    await this.plugin.saveSettings();
                }));
    }
}
