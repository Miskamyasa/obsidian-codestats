import {App, Setting, PluginSettingTab} from "obsidian";

import {ICodeStatsPlugin} from "./types";


export default class SettingsTab extends PluginSettingTab {
    plugin: ICodeStatsPlugin;

    constructor(app: App, plugin: ICodeStatsPlugin) {
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
