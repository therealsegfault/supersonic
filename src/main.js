import * as Phaser from 'phaser';
import { BootScene } from './BootScene.js';
import { MenuScene } from './MenuScene.js';
import { SongSelectScene } from './SongSelectScene.js';
import { GameScene } from './GameScene.js';
import { EndScene } from './EndScene.js';

// Global background color for non-game scenes
export const BACKGROUND_COLOR = '#0a0a0a';

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: BACKGROUND_COLOR,
    transparent: true,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, SongSelectScene, GameScene, EndScene]
};

await document.fonts.ready;
new Phaser.Game(config);