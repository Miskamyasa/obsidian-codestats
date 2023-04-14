import {App, Modal, Plugin} from 'obsidian';

import {ICodeStatsPlugin} from "./types";


export default class ApiKeyModal extends Modal {
    private opened = false;

    plugin: ICodeStatsPlugin;

    constructor(app: App, plugin: ICodeStatsPlugin) {
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
