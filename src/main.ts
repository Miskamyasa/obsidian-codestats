import {App, Modal, Plugin, PluginSettingTab, Setting} from 'obsidian';

import getISOTimestamp from "./getISOTimestamp";
import {ICodeStatsPlugin, IPluginSettings} from './types';
import ApiKeyModal from './ApiKeyModal';
import SettingsTab from './SettingsTab';

const DEFAULT_SETTINGS: IPluginSettings = {
    API_KEY: "",
    API_URL: "https://codestats.net/api",
}

const keysSet = new Set(["Meta", "Alt", "Shift", "Control", "CapsLock"]);

export default class CodeStatsPlugin extends Plugin implements ICodeStatsPlugin {
    settings: IPluginSettings;
    counter = 0;
    modal: Modal | null = null;

    async onload() {
        await this.loadSettings();

        this.modal = new ApiKeyModal(this.app, this);

        // This adds a new command to the command palette
        this.addCommand({
            id: 'open-codestats-key-modal',
            name: 'Enter Code::Stats API key',
            callback: () => {
                this.modal?.open();
            }
        });

        // This adds a status bar item at the bottom of the app
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('C::S');

        // This adds a settings tab so the user can configure api key
        this.addSettingTab(new SettingsTab(this.app, this));

        // This registers an keyboard press event listener 
        this.registerDomEvent(document, 'keyup', (evt) => {
            if (keysSet.has(evt.key) || evt.key.indexOf("Arrow") !== -1) {
                return;
            }
            this.counter += 1;
        });
    
        // This registers an interval to update stats every 10 seconds
        this.registerInterval(window.setInterval(() => {
            if (this.counter > 0) {
                void this.updateStats();
            }
        },  10000));
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
        try {
            void fetch(this.settings.API_URL + "/my/pulses", {
                method: 'POST',
                headers: {
                    'X-API-Token': this.settings.API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    coded_at: getISOTimestamp(new Date()),
                    xps: [{
                        language: 'Markdown',
                        xp: this.counter
                    }]
                })
            })
        } finally {
            this.counter = 0;
        }
    }

    onunload() {
        void this.updateStats();
    }
}

