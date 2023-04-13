import {Modal, Plugin} from 'obsidian';

export interface IPluginSettings {
    API_KEY: string;
    API_URL: string;
}

export interface ICodeStatsPlugin extends Plugin {
    settings: IPluginSettings;
    counter: number;
    modal: Modal | null;
    loadSettings: () => Promise<void>;
    saveSettings: () => Promise<void>;
}
