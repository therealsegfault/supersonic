import * as Phaser from 'phaser';
import { BootScene } from './BootScene.js';
import { MenuScene } from './MenuScene.js';
import { SongSelectScene } from './SongSelectScene.js';
import { GameScene } from './GameScene.js';
import { EndScene } from './EndScene.js';

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#000000',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, SongSelectScene, GameScene, EndScene]
};

new Phaser.Game(config);