import { Application, Assets, Sprite, Texture } from "pixi.js";
import { invokeCommand } from "./utils";
import { Point2D } from "./types";

enum DragStatus {
    Entered,
    Exited,
    Dragging,
}

export class Pet {
    private app: Application;
    private sprite?: Sprite;
    private isCursorEventsIgnored: boolean;
    private dragStatus: DragStatus;
    private dragOffset: Point2D;
    private isRunningClippy: boolean;

    constructor() {
        this.app = new Application();
        // this option was initially set to true during setup in Rust side
        this.isCursorEventsIgnored = true;
        // indicates whether 'clappy' is already running 'clippy' in the background,
        // used to prevent spamming clicks.
        this.isRunningClippy = false;
        this.dragStatus = DragStatus.Exited;
        this.dragOffset = { x: 0.0, y: 0.0 };
    }

    playAnimation(anim: string) {
        console.log('playing: ', anim);
    }

    showMessageDialog(msg: string) {
        console.log('displaying message: ', msg);
    }

    async setup() {
        await this.app.init({
            backgroundColor: 0x000000,
            backgroundAlpha: 0,
            resizeTo: window,
        });

        document.body.appendChild(this.app.canvas);
    }

    async preload() {
        // TODO: load multiple pet atlas from a json file
        const assets = [
            { alias: 'ferris', src: 'companions/ferris.png' },
        ]

        await Assets.load(assets);

        let sprite = new Sprite(Texture.from('ferris'));
        this.app.stage.addChild(sprite);

        // set the pet position to right bottom corner initially
        sprite.anchor.set(0.5);
        sprite.x = this.app.screen.width - sprite.width;
        sprite.y = this.app.screen.height - sprite.height;
        sprite.scale = 0.5;

        // setup interaction events
        sprite.interactive = true;
        sprite.on('mousedown', (e) => {
            this.dragStatus = DragStatus.Entered;
            this.dragOffset.x = e.global.x - sprite.x;
            this.dragOffset.y = e.global.y - sprite.y;
        });
        sprite.on('mouseup', () => {
            // the pet was not dragged nor currently "working", trigger `click` action instead
            if (this.dragStatus !== DragStatus.Dragging && !this.isRunningClippy) {
                this.isRunningClippy = true;
                this.playAnimation('working');
                invokeCommand('execute_clippy').then(() => this.isRunningClippy = false);
            }
            this.dragStatus = DragStatus.Exited;
        });
        sprite.on('mousemove', (e) => {
            if (this.dragStatus === DragStatus.Exited) return;
            // update pet position.
            // subtract the cursor point offset, otherwise the pet will suddenly get teleported
            sprite.x = e.clientX - this.dragOffset.x;
            sprite.y = e.clientY - this.dragOffset.y;

            this.dragStatus = DragStatus.Dragging;
        })

        this.sprite = sprite;
    }

    update() {
        this.app.ticker.add(() => {
            this.toggleCursorEvents();
        })
    }

    toggleCursorEvents() {
        invokeCommand('get_cursor_pos').then((res) => {
            const cursorPos = res as Point2D;
            const bounds = this.sprite?.getBounds();
            // if the cursor is within the pet's bound, enable cursor event, otherwise disable it.
            if (bounds && bounds.containsPoint(cursorPos.x, cursorPos.y)) {
                if (!this.isCursorEventsIgnored) {
                    // do nothing if cursor events was already enabled
                    return;
                }

                // NB: for some reason, `getCurrentWindow().setIgnoreCursorEvents` throws error
                invokeCommand('ignore_cursor_events', { ignore: false }).then(() => {
                    this.isCursorEventsIgnored = false;
                })
            } else if (!this.isCursorEventsIgnored) {
                invokeCommand('ignore_cursor_events', { ignore: true }).then(() => {
                    this.isCursorEventsIgnored = true;
                })
            }
        });
    }
}
