import * as Phaser from 'phaser';
import { BootScene } from './BootScene.js';
import { MenuScene } from './MenuScene.js';
import { GameScene } from './GameScene.js';

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#000000',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, GameScene]
};

new Phaser.Game(config);